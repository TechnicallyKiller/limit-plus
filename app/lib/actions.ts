"use client";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { LimitPlusClient, getProgram } from "@limit-plus/sdk";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";

type Sender = (tx: Transaction, c: Connection) => Promise<string>;

async function run(connection: Connection, owner: PublicKey, send: Sender, ixs: any[]) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = owner;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const sig = await send(tx, connection);
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

export async function deposit(connection: Connection, owner: PublicKey, send: Sender, roundKey: string, contracts: number) {
  const client = new LimitPlusClient(getProgram(connection));
  const pk = new PublicKey(roundKey);
  const round = await client.fetchRound(pk);
  const buy = "buyLower" in round.side;
  const mint: PublicKey = buy ? round.quoteMint : round.underlyingMint;
  const prog: PublicKey = buy ? round.quoteTokenProgram : round.underlyingTokenProgram;
  const ata = getAssociatedTokenAddressSync(mint, owner, true, prog);
  return run(connection, owner, send, [
    createAssociatedTokenAccountIdempotentInstruction(owner, ata, owner, mint, prog),
    await client.deposit(owner, pk, round, contracts),
  ]);
}

export async function claimAll(connection: Connection, owner: PublicKey, send: Sender, roundKey: string) {
  const client = new LimitPlusClient(getProgram(connection));
  const pk = new PublicKey(roundKey);
  const round = await client.fetchRound(pk);
  const pos = await client.fetchPosition(pk, owner);
  const ixs: any[] = [];
  for (const [mint, prog] of [[round.quoteMint, round.quoteTokenProgram], [round.underlyingMint, round.underlyingTokenProgram]] as [PublicKey, PublicKey][]) {
    ixs.push(createAssociatedTokenAccountIdempotentInstruction(owner, getAssociatedTokenAddressSync(mint, owner, true, prog), owner, mint, prog));
  }
  const state = Object.keys(round.state)[0];
  if (!pos.premiumClaimed && state !== "finalized" && state !== "noSale") ixs.push(await client.claimPremium(owner, pk, round));
  else if (state === "finalized" || state === "noSale") ixs.push(await client.claim(owner, pk, round));
  return run(connection, owner, send, ixs);
}
