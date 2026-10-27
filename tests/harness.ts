import { LiteSVM, Clock, FailedTransactionMetadata, TransactionMetadata } from "litesvm";
import {
  Connection, Keypair, PublicKey, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY, Transaction, TransactionInstruction,
} from "@solana/web3.js";
import {
  AccountLayout, ExtensionType, MINT_SIZE, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction, createInitializeScaledUiAmountConfigInstruction, createInitializeTransferFeeConfigInstruction,
  createMintToInstruction, getAssociatedTokenAddressSync, getMintLen,
} from "@solana/spl-token";
import { keccak256 } from "js-sha3";
import BN from "bn.js";
import * as path from "path";
import { LimitPlusClient, PROGRAM_ID, bidPda, computeCommitment, getProgram, positionPda, roundPda, vaultPda, CreateRoundArgs } from "../packages/sdk/src";

export const T0 = 1_000_000;
export const T = { bidStart: T0 + 100, candle: T0 + 200, bidEnd: T0 + 300, revealEnd: T0 + 400, expiry: T0 + 1000 };
export const FEED = new Uint8Array(32).fill(0xab);
export const CONTRACT = 1_000_000; // 0.01 token at 8 decimals
export const STRIKE = 1_800_000; // $1.80 per contract
export const RESERVE = 50_000;
export const PRICE = { atm: 18_000_000, above: 20_000_000, below: 15_000_000 }; // expo -5 => $180, $200, $150

export type Result = TransactionMetadata | FailedTransactionMetadata;

export class World {
  svm = new LiteSVM();
  client: LimitPlusClient;
  admin = Keypair.generate();
  treasury!: PublicKey;
  quoteMint!: PublicKey;
  underlyingMint!: PublicKey;
  now = T0;
  slot = 100n;

  constructor() {
    this.svm.addProgramFromFile(PROGRAM_ID, path.join(__dirname, "../target/deploy/limit_plus.so"));
    this.client = new LimitPlusClient(getProgram(new Connection("http://127.0.0.1:1")));
    this.client.fetchConfig = async () => ({ treasury: this.treasury }); // no RPC in LiteSVM
    this.svm.airdrop(this.admin.publicKey, 1_000_000_000_000n);
    this.setClock(T0);
    this.setSlotHash(0);
  }

  setClock(ts: number) {
    this.now = ts;
    this.slot += 10n;
    this.svm.setClock(new Clock(this.slot, BigInt(ts), 0n, 0n, BigInt(ts)));
    this.svm.expireBlockhash();
  }

  warp(ts: number) { this.setClock(ts); }

  setSlotHash(n: number) {
    const data = Buffer.alloc(8 + 8 + 32);
    data.writeBigUInt64LE(1n, 0);
    data.writeBigUInt64LE(this.slot, 8);
    Buffer.from(keccak256.arrayBuffer(Buffer.from(`seed-${n}`))).copy(data, 16);
    this.svm.setAccount(SYSVAR_SLOT_HASHES_PUBKEY, {
      lamports: 1_000_000_000, data, owner: new PublicKey("Sysvar1111111111111111111111111111111111111"), executable: false,
    });
  }

  /** Searches slot-hash seeds until the program will derive `target` as the cutoff for this round. */
  forceCutoff(round: PublicKey, candleStart: number, bidEnd: number, target: number) {
    for (let n = 0; n < 100000; n++) {
      const hash = Buffer.from(keccak256.arrayBuffer(Buffer.from(`seed-${n}`)));
      const seed = Buffer.from(keccak256.arrayBuffer(Buffer.concat([hash, round.toBuffer(), new BN(bidEnd).toArrayLike(Buffer, "le", 8)])));
      const r = seed.readBigUInt64LE(0);
      if (candleStart + Number(r % BigInt(bidEnd - candleStart + 1)) === target) { this.setSlotHash(n); return; }
    }
    throw new Error("no seed found");
  }

  fund(kp: Keypair, sol = 10) { this.svm.airdrop(kp.publicKey, BigInt(sol) * 1_000_000_000n); }
  user(sol = 10): Keypair { const k = Keypair.generate(); this.fund(k, sol); return k; }

  send(ixs: TransactionInstruction[], signers: Keypair[]): Result {
    const tx = new Transaction();
    tx.recentBlockhash = this.svm.latestBlockhash();
    tx.feePayer = signers[0].publicKey;
    tx.add(...ixs);
    tx.sign(...signers);
    const r = this.svm.sendTransaction(tx);
    this.svm.expireBlockhash();
    return r;
  }

  ok(ixs: TransactionInstruction[], signers: Keypair[]): TransactionMetadata {
    const r = this.send(ixs, signers);
    if (r instanceof FailedTransactionMetadata) throw new Error(`tx failed: ${r.err()}\n${r.meta().prettyLogs()}`);
    return r;
  }

  /** Returns the Anchor error name of a failed tx; throws if the tx succeeded. */
  fail(ixs: TransactionInstruction[], signers: Keypair[]): string {
    const r = this.send(ixs, signers);
    if (!(r instanceof FailedTransactionMetadata)) throw new Error("expected failure but tx succeeded");
    const logs = r.meta().logs().join("\n");
    const m = logs.match(/Error Code: (\w+)/);
    return m ? m[1] : `raw:${r.err()}\n${logs}`;
  }

  async createMint(decimals: number, opts: { token2022?: boolean; transferFee?: boolean; scaledUi?: boolean } = {}): Promise<PublicKey> {
    const mint = Keypair.generate();
    const program = opts.token2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const ixs: TransactionInstruction[] = [];
    const exts: ExtensionType[] = [];
    if (opts.transferFee) exts.push(ExtensionType.TransferFeeConfig);
    if (opts.scaledUi) exts.push(ExtensionType.ScaledUiAmountConfig);
    const len = opts.token2022 ? getMintLen(exts) : MINT_SIZE;
    ixs.push(SystemProgram.createAccount({
      fromPubkey: this.admin.publicKey, newAccountPubkey: mint.publicKey, space: len,
      lamports: Number(this.svm.minimumBalanceForRentExemption(BigInt(len))), programId: program,
    }));
    if (opts.transferFee) ixs.push(createInitializeTransferFeeConfigInstruction(mint.publicKey, this.admin.publicKey, this.admin.publicKey, 100, 1000n, program));
    if (opts.scaledUi) ixs.push(createInitializeScaledUiAmountConfigInstruction(mint.publicKey, this.admin.publicKey, 1.0, program));
    ixs.push(createInitializeMintInstruction(mint.publicKey, decimals, this.admin.publicKey, null, program));
    this.ok(ixs, [this.admin, mint]);
    return mint.publicKey;
  }

  programOf(mint: PublicKey) { return mint.equals(this.quoteMint) ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID; }

  /** Creates the owner's ATA (if needed) and mints `amount` into it. */
  mintTo(mint: PublicKey, owner: PublicKey, amount: bigint | number, program = this.programOf(mint)) {
    const ata = getAssociatedTokenAddressSync(mint, owner, true, program);
    const ixs: TransactionInstruction[] = [];
    if (!this.svm.getAccount(ata)) ixs.push(createAssociatedTokenAccountInstruction(this.admin.publicKey, ata, owner, mint, program));
    if (BigInt(amount) > 0n) ixs.push(createMintToInstruction(mint, ata, this.admin.publicKey, BigInt(amount), [], program));
    if (ixs.length) this.ok(ixs, [this.admin]);
    return ata;
  }

  balance(tokenAccount: PublicKey): bigint {
    const a = this.svm.getAccount(tokenAccount);
    if (!a) return 0n;
    return AccountLayout.decode(Buffer.from(a.data).subarray(0, AccountLayout.span)).amount;
  }
  bal(mint: PublicKey, owner: PublicKey) { return this.balance(getAssociatedTokenAddressSync(mint, owner, true, this.programOf(mint))); }
  vault(round: PublicKey, kind: "quote" | "underlying" | "premium" | "escrow") { return this.balance(vaultPda(round, kind)); }

  async setup(feeBps = 1000) {
    this.quoteMint = await this.createMint(6);
    this.underlyingMint = await this.createMint(8, { token2022: true, scaledUi: true });
    const treasuryOwner = Keypair.generate().publicKey;
    this.treasury = this.mintTo(this.quoteMint, treasuryOwner, 0);
    this.ok([await this.client.initializeConfig(this.admin.publicKey, feeBps, 100, this.quoteMint, this.treasury)], [this.admin]);
    // mock-oracle build only
  }

  roundArgs(id: number, side: "buyLower" | "sellHigher", over: Partial<CreateRoundArgs> = {}): CreateRoundArgs {
    return {
      roundId: id, side, pythFeedId: FEED, contractSizeRaw: CONTRACT, sharesPerContractE9: 10_000_000,
      strikePerContract: STRIKE, reservePremiumPerContract: RESERVE, fairPremiumPerContract: 120_000,
      openTs: T0, bidStartTs: T.bidStart, candleStartTs: T.candle, bidEndTs: T.bidEnd, revealEndTs: T.revealEnd,
      expiryTs: T.expiry, exerciseWindowSecs: 100, settleToleranceSecs: 300, settleGraceSecs: 1000, ...over,
    };
  }

  async createRound(id: number, side: "buyLower" | "sellHigher" = "buyLower", over: Partial<CreateRoundArgs> = {}) {
    const ix = await this.client.createRound(this.admin.publicKey, this.underlyingMint, this.quoteMint, this.roundArgs(id, side, over));
    this.ok([ix], [this.admin]);
    const key = roundPda(this.underlyingMint, id);
    return key;
  }

  async round(key: PublicKey) { return this.decodeRound(key); }
  async decodeRound(key: PublicKey) {
    const acc = this.svm.getAccount(key)!;
    return (this.client.program.coder.accounts as any).decode("round", Buffer.from(acc.data));
  }
  decode(name: string, key: PublicKey) {
    const acc = this.svm.getAccount(key);
    return acc ? (this.client.program.coder.accounts as any).decode(name, Buffer.from(acc.data)) : null;
  }

  async deposit(user: Keypair, key: PublicKey, contracts: number) {
    const r = await this.round(key);
    const buy = "buyLower" in r.side;
    // fund the user with exactly enough collateral
    const need = buy ? contracts * STRIKE : contracts * CONTRACT;
    this.mintTo(buy ? this.quoteMint : this.underlyingMint, user.publicKey, need);
    return this.client.deposit(user.publicKey, key, r, contracts);
  }

  async commit(bidder: Keypair, key: PublicKey, price: number, qty: number, escrow: number, salt = new Uint8Array(32).fill(bidder.publicKey.toBytes()[0])) {
    const r = await this.round(key);
    this.mintTo(this.quoteMint, bidder.publicKey, escrow);
    const c = computeCommitment(key, bidder.publicKey, price, qty, salt);
    return { ix: await this.client.commitBid(bidder.publicKey, key, r, c, escrow), salt };
  }

  async setPrice(price: number, publishTime = T.expiry, conf = 1000, feed = FEED) {
    return this.client.setMockPrice(this.admin.publicKey, feed, price, -5, conf, publishTime);
  }
}

export const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);
