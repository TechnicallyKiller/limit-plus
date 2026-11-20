/**
 * One-time, idempotent setup of a chain for the demo: a mock USDC mint, a mock NVDAx mint (Token-2022, scaled UI amount)
 * and the program config. Safe to re-run: existing mints and config are reused. Works on localnet and devnet.
 *
 *   yarn ts-node -P tsconfig.json scripts/setup-devnet.ts --rpc https://api.devnet.solana.com --admin ~/.config/limitplus/deployer.json \
 *     [--config config/addresses.devnet.json]
 *
 * The admin becomes the mint authority and the round admin, so keep that key private. Mock tokens have no value.
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import { LimitPlusClient, getProgram } from "../packages/sdk/src";
import { arg, loadKeypair, say, send } from "../bots/common";
import { createMint, fund } from "./lib";

export interface ChainSetup { quoteMint: PublicKey; underlyingMint: PublicKey; treasury: PublicKey; createdConfig: boolean }

const exists = async (c: Connection, k: string | undefined) => {
  if (!k) return null;
  try { const pk = new PublicKey(k); return (await c.getAccountInfo(pk)) ? pk : null; } catch { return null; }
};

export async function setupChain(c: Connection, admin: Keypair, existing: { quote?: string; underlying?: string } = {}, log: (m: string) => void = say): Promise<ChainSetup> {
  const client = new LimitPlusClient(getProgram(c));
  let quote = await exists(c, existing.quote);
  if (quote) log(`Mock USDC already exists: ${quote.toBase58()}`);
  else { quote = await createMint(c, admin, 6, "classic"); log(`Created mock USDC: ${quote.toBase58()}`); }
  let underlying = await exists(c, existing.underlying);
  if (underlying) log(`Mock NVDAx already exists: ${underlying.toBase58()}`);
  else { underlying = await createMint(c, admin, 8, "token2022-scaled"); log(`Created mock NVDAx: ${underlying.toBase58()}`); }

  const treasury = await fund(c, admin, quote, TOKEN_PROGRAM_ID, admin.publicKey, 0n);
  let createdConfig = false;
  try {
    const cfg = await client.fetchConfig();
    if (cfg.quoteMint.toBase58() !== quote.toBase58()) throw new Error(`The program config on this chain uses a different USDC mint (${cfg.quoteMint.toBase58()}). Pass that mint, or deploy to a fresh program id.`);
    log("Program config already initialised.");
  } catch (e: any) {
    if (/different USDC mint/.test(String(e?.message))) throw e;
    await send(c, [await client.initializeConfig(admin.publicKey, 1000, 100, quote, treasury)], [admin]);
    createdConfig = true;
    log("Initialised the program config (10% protocol fee).");
  }
  return { quoteMint: quote, underlyingMint: underlying, treasury, createdConfig };
}

if (require.main === module) {
  (async () => {
    const c = new Connection(arg("rpc"), "confirmed");
    const admin = loadKeypair(arg("admin"));
    const cfgPath = arg("config", "config/addresses.devnet.json");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    const out = await setupChain(c, admin, { quote: cfg.quote_mint?.address, underlying: cfg.underlying_mint?.address });
    cfg.quote_mint = { address: out.quoteMint.toBase58(), source: "mock USDC (6 decimals), created by scripts/setup-devnet.ts, mint authority is the demo admin" };
    cfg.underlying_mint = { address: out.underlyingMint.toBase58(), source: "mock NVDAx (Token-2022 scaled UI amount, 8 decimals), created by scripts/setup-devnet.ts" };
    cfg.treasury = { address: out.treasury.toBase58(), source: "admin's mock USDC token account" };
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
    say(`Wrote ${cfgPath}`);
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
