import { BN, Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { keccak256 } from "js-sha3";
import idl from "./idl.json";

export { idl };
export const PROGRAM_ID = new PublicKey((idl as any).address);

const enc = (s: string) => Buffer.from(s);
export const u64le = (n: BN | bigint | number) => new BN(n.toString()).toArrayLike(Buffer, "le", 8);

export type Side = "buyLower" | "sellHigher";
export const sideArg = (s: Side) => (s === "buyLower" ? { buyLower: {} } : { sellHigher: {} });

export const configPda = () => PublicKey.findProgramAddressSync([enc("config")], PROGRAM_ID)[0];
export const roundPda = (underlyingMint: PublicKey, roundId: BN | bigint | number) =>
  PublicKey.findProgramAddressSync([enc("round"), underlyingMint.toBuffer(), u64le(roundId)], PROGRAM_ID)[0];
export type VaultKind = "quote" | "underlying" | "premium" | "escrow";
export const vaultPda = (round: PublicKey, kind: VaultKind) =>
  PublicKey.findProgramAddressSync([enc("vault"), round.toBuffer(), enc(kind)], PROGRAM_ID)[0];
export const positionPda = (round: PublicKey, owner: PublicKey) =>
  PublicKey.findProgramAddressSync([enc("position"), round.toBuffer(), owner.toBuffer()], PROGRAM_ID)[0];
export const bidPda = (round: PublicKey, bidder: PublicKey) =>
  PublicKey.findProgramAddressSync([enc("bid"), round.toBuffer(), bidder.toBuffer()], PROGRAM_ID)[0];
export const mockPricePda = (feedId: Uint8Array) =>
  PublicKey.findProgramAddressSync([enc("mock_price"), Buffer.from(feedId)], PROGRAM_ID)[0];

/** keccak256(round || bidder || price_le || qty_le || salt); must match programs/limit_plus/src/math.rs. */
export function computeCommitment(round: PublicKey, bidder: PublicKey, price: BN | bigint | number, qty: BN | bigint | number, salt: Uint8Array): Buffer {
  const buf = Buffer.concat([round.toBuffer(), bidder.toBuffer(), u64le(price), u64le(qty), Buffer.from(salt)]);
  return Buffer.from(keccak256.arrayBuffer(buf));
}

export type RoundAccount = any;
export type Phase = "deposit" | "bidding" | "awaitingCutoff" | "reveal" | "awaitingClear" | "noSale" | "cleared" | "awaitingSettle" | "exercise" | "awaitingFinalize" | "finalized";

const stateName = (s: any): string => Object.keys(s)[0];

/** Where a round is right now, combining on-chain state with the clock. */
export function phaseOf(r: RoundAccount, now: number): Phase {
  const st = stateName(r.state);
  const n = (x: any) => Number(x.toString());
  if (st === "deposit" || st === "bidding") {
    if (now < n(r.bidStartTs)) return "deposit";
    if (now < n(r.bidEndTs)) return "bidding";
    return "awaitingCutoff";
  }
  if (st === "reveal") return now < n(r.revealEndTs) ? "reveal" : "awaitingClear";
  if (st === "noSale") return "noSale";
  if (st === "cleared") return now < n(r.expiryTs) ? "cleared" : "awaitingSettle";
  if (st === "settled") {
    const windowEnd = n(r.expiryTs) + n(r.exerciseWindowSecs);
    const done = now >= windowEnd || !r.inTheMoney || r.exercisedContracts.eq(r.soldContracts);
    return done ? "awaitingFinalize" : "exercise";
  }
  return "finalized";
}

export const tokenProgramFor = (owner: PublicKey) => owner;
export const ata = (mint: PublicKey, owner: PublicKey, tokenProgram: PublicKey) =>
  getAssociatedTokenAddressSync(mint, owner, true, tokenProgram);
export { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID };

export interface CreateRoundArgs {
  roundId: BN | number;
  side: Side;
  pythFeedId: Uint8Array;
  contractSizeRaw: BN | number;
  sharesPerContractE9: BN | number;
  strikePerContract: BN | number;
  reservePremiumPerContract: BN | number;
  fairPremiumPerContract: BN | number;
  openTs: BN | number;
  bidStartTs: BN | number;
  candleStartTs: BN | number;
  bidEndTs: BN | number;
  revealEndTs: BN | number;
  expiryTs: BN | number;
  exerciseWindowSecs: BN | number;
  settleToleranceSecs: BN | number;
  settleGraceSecs: BN | number;
}

const bn = (x: BN | number | bigint) => (BN.isBN(x) ? x : new BN(x.toString()));

export function getProgram(connection: Connection, wallet?: any): Program<Idl> {
  const provider = new AnchorProvider(connection, wallet ?? ({ publicKey: PublicKey.default } as any), {});
  return new Program(idl as Idl, provider);
}

/** Instruction builders. Every method resolves all accounts so callers only pass keys. */
export class LimitPlusClient {
  constructor(public program: Program<Idl>) {}
  private get m() { return this.program.methods as any; }

  fetchRound(round: PublicKey): Promise<RoundAccount> { return (this.program.account as any).round.fetch(round); }
  fetchConfig(): Promise<any> { return (this.program.account as any).config.fetch(configPda()); }
  fetchPosition(round: PublicKey, owner: PublicKey) { return (this.program.account as any).position.fetch(positionPda(round, owner)); }
  fetchBid(round: PublicKey, bidder: PublicKey) { return (this.program.account as any).bid.fetch(bidPda(round, bidder)); }
  fetchAllRounds(): Promise<{ publicKey: PublicKey; account: RoundAccount }[]> { return (this.program.account as any).round.all(); }
  fetchBidsForRound(round: PublicKey): Promise<{ publicKey: PublicKey; account: any }[]> {
    return (this.program.account as any).bid.all([{ memcmp: { offset: 9, bytes: round.toBase58() } }]);
  }

  initializeConfig(admin: PublicKey, feeBps: number, maxConfBps: number, quoteMint: PublicKey, treasury: PublicKey): Promise<TransactionInstruction> {
    return this.m.initializeConfig(feeBps, maxConfBps, quoteMint, treasury)
      .accountsStrict({ admin, config: configPda(), systemProgram: SystemProgram.programId }).instruction();
  }

  updateConfig(admin: PublicKey, feeBps: number, maxConfBps: number, paused: boolean, treasury: PublicKey) {
    return this.m.updateConfig(feeBps, maxConfBps, paused, treasury).accountsStrict({ admin, config: configPda() }).instruction();
  }

  createRound(admin: PublicKey, underlyingMint: PublicKey, quoteMint: PublicKey, a: CreateRoundArgs,
    quoteTokenProgram = TOKEN_PROGRAM_ID, underlyingTokenProgram = TOKEN_2022_PROGRAM_ID) {
    const round = roundPda(underlyingMint, bn(a.roundId));
    const params = {
      roundId: bn(a.roundId), side: sideArg(a.side), pythFeedId: Array.from(a.pythFeedId),
      contractSizeRaw: bn(a.contractSizeRaw), sharesPerContractE9: bn(a.sharesPerContractE9),
      strikePerContract: bn(a.strikePerContract), reservePremiumPerContract: bn(a.reservePremiumPerContract),
      fairPremiumPerContract: bn(a.fairPremiumPerContract), openTs: bn(a.openTs), bidStartTs: bn(a.bidStartTs),
      candleStartTs: bn(a.candleStartTs), bidEndTs: bn(a.bidEndTs), revealEndTs: bn(a.revealEndTs),
      expiryTs: bn(a.expiryTs), exerciseWindowSecs: bn(a.exerciseWindowSecs),
      settleToleranceSecs: bn(a.settleToleranceSecs), settleGraceSecs: bn(a.settleGraceSecs),
    };
    return this.m.createRound(params).accountsStrict({
      admin, config: configPda(), underlyingMint, quoteMint, round,
      quoteVault: vaultPda(round, "quote"), underlyingVault: vaultPda(round, "underlying"),
      premiumVault: vaultPda(round, "premium"), escrowVault: vaultPda(round, "escrow"),
      quoteTokenProgram, underlyingTokenProgram, systemProgram: SystemProgram.programId,
    }).instruction() as Promise<TransactionInstruction>;
  }

  private collateral(round: RoundAccount) {
    const buy = "buyLower" in round.side;
    return {
      mint: buy ? round.quoteMint : round.underlyingMint as PublicKey,
      program: buy ? round.quoteTokenProgram : round.underlyingTokenProgram as PublicKey,
      kind: (buy ? "quote" : "underlying") as VaultKind,
    };
  }

  deposit(owner: PublicKey, roundKey: PublicKey, round: RoundAccount, contracts: BN | number) {
    const c = this.collateral(round);
    return this.m.deposit(bn(contracts)).accountsStrict({
      owner, config: configPda(), round: roundKey, position: positionPda(roundKey, owner), mint: c.mint,
      userToken: ata(c.mint, owner, c.program), vault: vaultPda(roundKey, c.kind), tokenProgram: c.program,
      systemProgram: SystemProgram.programId,
    }).instruction() as Promise<TransactionInstruction>;
  }

  withdraw(owner: PublicKey, roundKey: PublicKey, round: RoundAccount, contracts: BN | number) {
    const c = this.collateral(round);
    return this.m.withdraw(bn(contracts)).accountsStrict({
      owner, round: roundKey, position: positionPda(roundKey, owner), mint: c.mint,
      userToken: ata(c.mint, owner, c.program), vault: vaultPda(roundKey, c.kind), tokenProgram: c.program,
    }).instruction() as Promise<TransactionInstruction>;
  }

  commitBid(bidder: PublicKey, roundKey: PublicKey, round: RoundAccount, commitment: Uint8Array, escrow: BN | number) {
    return this.m.commitBid(Array.from(commitment), bn(escrow)).accountsStrict({
      bidder, config: configPda(), round: roundKey, bid: bidPda(roundKey, bidder), quoteMint: round.quoteMint,
      bidderQuote: ata(round.quoteMint, bidder, round.quoteTokenProgram), escrowVault: vaultPda(roundKey, "escrow"),
      tokenProgram: round.quoteTokenProgram, systemProgram: SystemProgram.programId,
    }).instruction() as Promise<TransactionInstruction>;
  }

  resolveCutoff(cranker: PublicKey, roundKey: PublicKey) {
    return this.m.resolveCutoff().accountsStrict({ cranker, round: roundKey, slotHashes: SYSVAR_SLOT_HASHES_PUBKEY }).instruction() as Promise<TransactionInstruction>;
  }

  revealBid(bidder: PublicKey, roundKey: PublicKey, price: BN | number, qty: BN | number, salt: Uint8Array) {
    return this.m.revealBid(bn(price), bn(qty), Array.from(salt)).accountsStrict({
      bidder, round: roundKey, bid: bidPda(roundKey, bidder),
    }).instruction() as Promise<TransactionInstruction>;
  }

  async clearAuction(cranker: PublicKey, roundKey: PublicKey, round: RoundAccount, bidAccounts: PublicKey[]) {
    const config = await this.fetchConfig();
    return this.m.clearAuction().accountsStrict({
      cranker, config: configPda(), round: roundKey, quoteMint: round.quoteMint,
      quoteVault: vaultPda(roundKey, "quote"), underlyingVault: vaultPda(roundKey, "underlying"),
      premiumVault: vaultPda(roundKey, "premium"), escrowVault: vaultPda(roundKey, "escrow"),
      treasury: config.treasury, quoteTokenProgram: round.quoteTokenProgram,
    }).remainingAccounts(bidAccounts.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true }))).instruction() as Promise<TransactionInstruction>;
  }

  claimPremium(owner: PublicKey, roundKey: PublicKey, round: RoundAccount) {
    return this.m.claimPremium().accountsStrict({
      owner, round: roundKey, position: positionPda(roundKey, owner), quoteMint: round.quoteMint,
      premiumVault: vaultPda(roundKey, "premium"), userQuote: ata(round.quoteMint, owner, round.quoteTokenProgram),
      tokenProgram: round.quoteTokenProgram,
    }).instruction() as Promise<TransactionInstruction>;
  }

  claimRefund(bidder: PublicKey, roundKey: PublicKey, round: RoundAccount) {
    return this.m.claimRefund().accountsStrict({
      bidder, round: roundKey, bid: bidPda(roundKey, bidder), quoteMint: round.quoteMint,
      escrowVault: vaultPda(roundKey, "escrow"), bidderQuote: ata(round.quoteMint, bidder, round.quoteTokenProgram),
      tokenProgram: round.quoteTokenProgram,
    }).instruction() as Promise<TransactionInstruction>;
  }

  /** `priceAccount` = Pyth PriceUpdateV2 account, or the MockPrice PDA on mock-oracle builds. */
  settle(cranker: PublicKey, roundKey: PublicKey, round: RoundAccount, priceAccount: PublicKey) {
    return this.m.settle().accountsStrict({
      cranker, config: configPda(), round: roundKey, quoteMint: round.quoteMint, priceAccount,
    }).instruction() as Promise<TransactionInstruction>;
  }

  expireWithoutPrice(cranker: PublicKey, roundKey: PublicKey) {
    return this.m.expireWithoutPrice().accountsStrict({ cranker, round: roundKey }).instruction() as Promise<TransactionInstruction>;
  }

  exercise(bidder: PublicKey, roundKey: PublicKey, round: RoundAccount) {
    return this.m.exercise().accountsStrict({
      bidder, round: roundKey, bid: bidPda(roundKey, bidder), quoteMint: round.quoteMint, underlyingMint: round.underlyingMint,
      quoteVault: vaultPda(roundKey, "quote"), underlyingVault: vaultPda(roundKey, "underlying"),
      bidderQuote: ata(round.quoteMint, bidder, round.quoteTokenProgram),
      bidderUnderlying: ata(round.underlyingMint, bidder, round.underlyingTokenProgram),
      quoteTokenProgram: round.quoteTokenProgram, underlyingTokenProgram: round.underlyingTokenProgram,
    }).instruction() as Promise<TransactionInstruction>;
  }

  finalize(cranker: PublicKey, roundKey: PublicKey) {
    return this.m.finalize().accountsStrict({
      cranker, round: roundKey, quoteVault: vaultPda(roundKey, "quote"), underlyingVault: vaultPda(roundKey, "underlying"),
    }).instruction() as Promise<TransactionInstruction>;
  }

  claim(owner: PublicKey, roundKey: PublicKey, round: RoundAccount) {
    return this.m.claim().accountsStrict({
      owner, round: roundKey, position: positionPda(roundKey, owner), quoteMint: round.quoteMint, underlyingMint: round.underlyingMint,
      quoteVault: vaultPda(roundKey, "quote"), underlyingVault: vaultPda(roundKey, "underlying"), premiumVault: vaultPda(roundKey, "premium"),
      userQuote: ata(round.quoteMint, owner, round.quoteTokenProgram),
      userUnderlying: ata(round.underlyingMint, owner, round.underlyingTokenProgram),
      quoteTokenProgram: round.quoteTokenProgram, underlyingTokenProgram: round.underlyingTokenProgram,
    }).instruction() as Promise<TransactionInstruction>;
  }

  /** Only exists on builds with `--features mock-oracle`. */
  setMockPrice(admin: PublicKey, feedId: Uint8Array, price: BN | number, expo: number, conf: BN | number, publishTime: BN | number) {
    return this.m.setMockPrice(Array.from(feedId), bn(price), expo, bn(conf), bn(publishTime)).accountsStrict({
      admin, config: configPda(), mockPrice: mockPricePda(feedId), systemProgram: SystemProgram.programId,
    }).instruction() as Promise<TransactionInstruction>;
  }
}

export function newSalt(): Uint8Array {
  return Keypair.generate().secretKey.slice(0, 32);
}
