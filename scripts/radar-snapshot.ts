/**
 * Runs the Risk Radar against live TinyFish for every covered stock and writes the result to
 * packages/radar/src/snapshot.json. That file is the fallback the app shows if the live radar is unreachable,
 * and it is labelled "snapshot" with its real timestamp, never passed off as live.
 *
 *   TINYFISH_API_KEY=... yarn ts-node -P tsconfig.json scripts/radar-snapshot.ts [--print]
 */
import * as fs from "fs";
import * as path from "path";
import { COMPANIES, RadarService, tinyfishSearch, type RadarSnapshot } from "../packages/radar/src";

(async () => {
  const svc = new RadarService(tinyfishSearch(undefined, { log: console.log }), { tickers: Object.keys(COMPANIES), gapMs: 800, log: console.log });
  await svc.refreshAll();
  const snaps: RadarSnapshot[] = svc.all().map((s) => ({ ...s, provider: "snapshot" as const }));
  const bad = snaps.filter((s) => s.level === "unknown");
  if (snaps.length !== Object.keys(COMPANIES).length) throw new Error(`only ${snaps.length} of ${Object.keys(COMPANIES).length} stocks returned a snapshot`);
  if (bad.length) throw new Error(`incomplete checks for ${bad.map((b) => `${b.ticker} (${b.failures.join(",") || "no results"})`).join(", ")}; not writing a partial snapshot`);
  if (!process.argv.includes("--print")) {
    fs.writeFileSync(path.join(__dirname, "../packages/radar/src/snapshot.json"), JSON.stringify(snaps, null, 2) + "\n");
    console.log(`wrote ${snaps.length} snapshots`);
  } else console.log(JSON.stringify(snaps, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
