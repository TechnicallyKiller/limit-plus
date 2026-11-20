/**
 * Demo director: runs a compressed "week" of Limit+ on a chain with the mock oracle, so a person can walk through the whole
 * product in about three minutes. It creates a round at the live NVDA price, deposits a small house position so there is
 * always something to bid on, runs two market-maker bots and the keeper, and posts the Friday close that decides the outcome.
 * It also hands out mock USDC and a little SOL to a wallet (the faucet).
 *
 * Restart safe: nothing is kept only in memory. The outcome is encoded in the round id, the bots derive their bid salts from
 * the admin key, and `resume()` picks an unfinished round back up.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createHash } from "crypto";
import { LimitPlusClient, getProgram, phaseOf, roundPda, type Phase } from "../packages/sdk/src";
import { buildRound, fund, sendCreateRound } from "../scripts/lib";
import { chainNow, errText, send, sleep } from "./common";
import { runKeeper } from "./keeper";
import { runMmBot } from "./mm-bot";

export type Outcome = "buy" | "skip";
export const NVDA_FEED = Uint8Array.from(Buffer.from("b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593", "hex"));

export interface Timings { depositSecs: number; bidSecs: number; candleSecs: number; revealSecs: number; expirySecs: number; exerciseSecs: number }
export const DEFAULT_TIMINGS: Timings = { depositSecs: 60, bidSecs: 40, candleSecs: 10, revealSecs: 20, expirySecs: 20, exerciseSecs: 40 };

export interface DemoState {
  status: "idle" | "running" | "finished" | "failed";
  roundKey?: string;
  outcome?: Outcome;
  spot?: number;
  yourPrice?: number;
  closePrice?: number;
  startedAt?: number;
  phase?: Phase;
  expiryTs?: number;
  error?: string;
  /** The last lines of what the bots and keeper did, newest last. */
  feed: string[];
}

export class DirectorError extends Error {
  constructor(public code: "busy" | "bad_request" | "unavailable", message: string) { super(message); }
}

export interface DirectorOpts {
  connection: Connection;
  admin: Keypair;
  quoteMint: PublicKey;
  underlyingMint: PublicKey;
  log?: (m: string) => void;
  /** Live NVDA price. Falls back to 180 when it cannot be fetched. */
  spot?: () => Promise<number>;
  timings?: Partial<Timings>;
  pollMs?: number;
  /** A running demo older than this is considered stuck and can be replaced. */
  maxRunSecs?: number;
  /** Mock USDC handed out per faucet call, in whole dollars. */
  faucetUsdc?: number;
  faucetSol?: number;
}

const deriveKey = (admin: Keypair, label: string) => Keypair.fromSeed(createHash("sha256").update(admin.secretKey).update(label).digest());

export async function hermesSpot(): Promise<number> {
  const id = Buffer.from(NVDA_FEED).toString("hex");
  const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=0x${id}&parsed=true`, { signal: AbortSignal.timeout(4000) });
  const j: any = await res.json();
  const p = j.parsed[0].price;
  const v = Number(p.price) * 10 ** p.expo;
  if (!Number.isFinite(v) || v < 1 || v > 10_000) throw new Error("implausible price");
  return v;
}

export class Director {
  private client: LimitPlusClient;
  private state: DemoState = { status: "idle", feed: [] };
  private stop = { stop: false };
  private starting = false;
  private mm = [
    { name: "alpha", edge: 0.1, kp: deriveKey(this.o.admin, "mm-alpha") },
    { name: "beta", edge: 0.2, kp: deriveKey(this.o.admin, "mm-beta") },
  ];
  private house = deriveKey(this.o.admin, "house-user");
  private saltSecret = createHash("sha256").update(this.o.admin.secretKey).update("bid-salt").digest();

  constructor(private o: DirectorOpts) { this.client = new LimitPlusClient(getProgram(o.connection)); }

  private say(m: string) {
    const line = `${new Date().toISOString().slice(11, 19)} ${m}`;
    this.state.feed = [...this.state.feed, line].slice(-60);
    this.o.log?.(m);
  }

  /** Public view of the demo. Phase is read live from the chain when a round exists. */
  async status(): Promise<DemoState> {
    if (this.state.roundKey) {
      try {
        const r = await this.client.fetchRound(new PublicKey(this.state.roundKey));
        this.state.phase = phaseOf(r, await chainNow(this.o.connection));
      } catch { /* keep the last known phase */ }
    }
    return { ...this.state, feed: [...this.state.feed] };
  }

  private async topUp(kp: Keypair, minSol: number, quoteUsdc: number, underlying: bigint) {
    const c = this.o.connection;
    const bal = await c.getBalance(kp.publicKey);
    if (bal < minSol * LAMPORTS_PER_SOL) {
      await sendAndConfirmTransaction(c, new Transaction().add(SystemProgram.transfer({ fromPubkey: this.o.admin.publicKey, toPubkey: kp.publicKey, lamports: Math.ceil(minSol * 2 * LAMPORTS_PER_SOL) })), [this.o.admin], { commitment: "confirmed" });
    }
    const have = async (mint: PublicKey, prog: PublicKey) => {
      try { return BigInt((await c.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, kp.publicKey, true, prog))).value.amount); } catch { return 0n; }
    };
    const q = BigInt(quoteUsdc) * 1_000_000n;
    if ((await have(this.o.quoteMint, TOKEN_PROGRAM_ID)) < q / 2n) await fund(c, this.o.admin, this.o.quoteMint, TOKEN_PROGRAM_ID, kp.publicKey, q);
    if (underlying > 0n && (await have(this.o.underlyingMint, TOKEN_2022_PROGRAM_ID)) < underlying / 2n) await fund(c, this.o.admin, this.o.underlyingMint, TOKEN_2022_PROGRAM_ID, kp.publicKey, underlying);
  }

  /** Starts a demo week. Returns as soon as the round exists; the rest runs in the background. */
  async start(outcome: Outcome, opts: { depositSecs?: number } = {}): Promise<DemoState> {
    if (outcome !== "buy" && outcome !== "skip") throw new DirectorError("bad_request", "outcome must be buy or skip");
    const t: Timings = { ...DEFAULT_TIMINGS, ...this.o.timings };
    if (opts.depositSecs !== undefined) {
      if (!Number.isFinite(opts.depositSecs) || opts.depositSecs < 20 || opts.depositSecs > 300) throw new DirectorError("bad_request", "depositSecs must be between 20 and 300");
      t.depositSecs = Math.round(opts.depositSecs);
    }
    if (this.starting) throw new DirectorError("busy", "A demo week is already starting.");
    const age = this.state.startedAt ? Date.now() / 1000 - this.state.startedAt : Infinity;
    if (this.state.status === "running" && age < (this.o.maxRunSecs ?? 900)) throw new DirectorError("busy", "A demo week is already running. Watch it, or wait for it to finish.");
    this.starting = true;
    try {
      this.stop.stop = true; // retire anything left over from a stuck run
      this.stop = { stop: false };
      const c = this.o.connection;
      let spot = 180;
      try { spot = await (this.o.spot ?? hermesSpot)(); } catch { this.say("Live NVDA price unavailable, using $180."); }
      spot = Math.round(spot * 100) / 100;

      await this.topUp(this.house, 0.02, 10, 0n);
      for (const b of this.mm) await this.topUp(b.kp, 0.05, 1000, 5_000_000_000n);

      const secs = Math.floor(Date.now() / 1000);
      const roundId = secs * 2 + (outcome === "buy" ? 0 : 1); // the outcome rides along in the id, so a restart can recover it
      const built = await buildRound({ roundId, side: "buyLower", spot, pct: 0.05, vol: 0.46, yearsOverride: 5 / 365, feedId: NVDA_FEED, now: await chainNow(c), timings: t });
      const { _meta, ...args } = built;
      const round = await sendCreateRound(c, this.client, this.o.admin, this.o.underlyingMint, this.o.quoteMint, args);
      const yourPrice = _meta.strikeUsd / 0.01;
      this.state = { status: "running", roundKey: round.toBase58(), outcome, spot, yourPrice, startedAt: secs, expiryTs: Number(args.expiryTs), feed: [] };
      this.say(`Demo week started. NVDAx is $${spot.toFixed(2)}. You can name a price of $${yourPrice.toFixed(2)}, which is 5% below.`);

      // The house position guarantees the auction has something to bid on even if nobody else deposits.
      const r0 = await this.client.fetchRound(round);
      await send(c, [await this.client.deposit(this.house.publicKey, round, r0, 2)], [this.house]);
      void this.run(round, outcome, yourPrice);
      return this.status();
    } finally { this.starting = false; }
  }

  /** Background orchestration for one round: bots, keeper, and the Friday close. */
  private async run(round: PublicKey, outcome: Outcome, yourPrice: number) {
    const c = this.o.connection;
    const signal = this.stop;
    const log = (m: string) => this.say(m.replace(/^» /, ""));
    try {
      const keeper = runKeeper({ connection: c, payer: this.o.admin, round, oracle: "mock", pollMs: this.o.pollMs ?? 1500, signal, log });
      const bots = (async () => {
        // Bots start bidding when the window opens, sized to the pool that actually deposited.
        for (;;) {
          if (signal.stop) return;
          const r = await this.client.fetchRound(round);
          const ph = phaseOf(r, await chainNow(c));
          if (ph !== "deposit") {
            const total = Math.max(Number(r.totalContracts.toString()), 2);
            const size = Math.max(Math.ceil(total / 2), 1);
            await Promise.all(this.mm.map((b) => runMmBot({ connection: c, wallet: b.kp, name: `${b.name}-${round.toBase58().slice(0, 4)}`, edge: b.edge, size, round, pollMs: this.o.pollMs ?? 1500, signal, log, saltSecret: this.saltSecret, stateDir: ".bids" })));
            return;
          }
          await sleep(1000);
        }
      })();
      const closer = (async () => {
        for (;;) {
          if (signal.stop) return;
          const r = await this.client.fetchRound(round);
          const ph = phaseOf(r, await chainNow(c));
          if (ph === "cleared" || ph === "awaitingSettle") break;
          if (ph === "noSale" || ph === "finalized") return;
          await sleep(1500);
        }
        const r = await this.client.fetchRound(round);
        const close = Math.round(yourPrice * (outcome === "buy" ? 0.96 : 1.04) * 100) / 100;
        await send(c, [await this.client.setMockPrice(this.o.admin.publicKey, NVDA_FEED, Math.round(close * 1e5), -5, 1000, Number(r.expiryTs.toString()))], [this.o.admin]);
        this.state.closePrice = close;
        this.say(outcome === "buy" ? `Friday close: $${close.toFixed(2)}, below your price, so you buy.` : `Friday close: $${close.toFixed(2)}, above your price, so you get your money back.`);
      })();
      await Promise.all([keeper, bots, closer]);
      this.state.status = "finished";
      this.say("The demo week is over. Open your portfolio to claim.");
    } catch (e) {
      this.state.status = "failed";
      this.state.error = errText(e).slice(0, 300);
      this.say(`The demo week hit a problem: ${this.state.error}`);
    }
  }

  /** After a restart: pick the newest unfinished round of ours back up. */
  async resume(): Promise<boolean> {
    try {
      const rounds = (await this.client.fetchAllRounds()).filter((x) => x.account.underlyingMint.equals(this.o.underlyingMint) && x.account.creator.equals(this.o.admin.publicKey));
      rounds.sort((a, b) => Number(b.account.openTs.toString()) - Number(a.account.openTs.toString()));
      const latest = rounds[0];
      if (!latest) return false;
      const now = await chainNow(this.o.connection);
      const ph = phaseOf(latest.account, now);
      const age = now - Number(latest.account.openTs.toString());
      if (ph === "finalized" || ph === "noSale" || age > 20 * 60) return false;
      const id = BigInt(latest.account.roundId.toString());
      const outcome: Outcome = id % 2n === 0n ? "buy" : "skip";
      const yourPrice = Number(latest.account.strikePerContract.toString()) / 1e6 / (Number(latest.account.sharesPerContractE9.toString()) / 1e9);
      this.state = { status: "running", roundKey: latest.publicKey.toBase58(), outcome, yourPrice, startedAt: Number(latest.account.openTs.toString()), expiryTs: Number(latest.account.expiryTs.toString()), feed: [] };
      this.stop = { stop: false };
      this.say("Restarted. Picking the demo week back up.");
      void this.run(latest.publicKey, outcome, yourPrice);
      return true;
    } catch { return false; }
  }

  /** Mock USDC and a little SOL for a wallet, so a visitor can deposit and pay fees. */
  async faucet(wallet: string): Promise<{ usdc: number; sol: number }> {
    let owner: PublicKey;
    try { owner = new PublicKey(wallet); } catch { throw new DirectorError("bad_request", "That is not a valid wallet address."); }
    const c = this.o.connection;
    const usdc = this.o.faucetUsdc ?? 1000, sol = this.o.faucetSol ?? 0.02;
    const bal = await c.getBalance(owner);
    let sentSol = 0;
    if (bal < sol * LAMPORTS_PER_SOL) {
      await sendAndConfirmTransaction(c, new Transaction().add(SystemProgram.transfer({ fromPubkey: this.o.admin.publicKey, toPubkey: owner, lamports: Math.round(sol * LAMPORTS_PER_SOL) })), [this.o.admin], { commitment: "confirmed" });
      sentSol = sol;
    }
    await fund(c, this.o.admin, this.o.quoteMint, TOKEN_PROGRAM_ID, owner, BigInt(usdc) * 1_000_000n);
    return { usdc, sol: sentSol };
  }

  /** Stops background work. Used on shutdown and in tests. */
  shutdown() { this.stop.stop = true; }
}

export { roundPda };
