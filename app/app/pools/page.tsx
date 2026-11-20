"use client";
import { useMemo, useState } from "react";
import PoolsTreemap from "@/components/PoolsTreemap";
import { Odometer, ExampleNote } from "@/components/ui";
import { loadPools, useNow, usePolled } from "@/lib/live";
import { POLL_MS } from "@/lib/chain";
import { RadarPill } from "@/components/RiskRadar";
import { useRadar } from "@/lib/radar";
import { EXAMPLE_POOLS } from "@/lib/examples";
import { countdown, pct, signedPct, usdWhole } from "@/lib/format";
import type { PoolView } from "@/lib/types";
import { nextFridayClose } from "@limit-plus/radar/src/dates";
import { SegmentedControl } from "@/components/ui";
import Link from "next/link";

/** Seconds until the next official close (Friday 4pm New York), counting the same Friday before the close. */
const untilClose = (now: number) => Math.floor(nextFridayClose(now * 1000) / 1000) - now;

export default function PoolsPage() {
  const { data: pools } = usePolled<PoolView[]>(loadPools, EXAMPLE_POOLS, POLL_MS);
  const [stock, setStock] = useState("all");
  const [view, setView] = useState<"board" | "list">("board");
  const [sel, setSel] = useState<PoolView | undefined>();
  const now = useNow();
  const tickers = useMemo(() => Array.from(new Set(pools.map((p) => p.ticker))), [pools]);
  const shown = pools.filter((p) => stock === "all" || p.ticker === stock);
  const waiting = pools.reduce((a, p) => a + p.waitingUsd, 0);
  const paid = pools.reduce((a, p) => a + (p.waitingUsd * p.ratePct) / 100, 0);
  const peek = sel ?? shown[0];
  const radar = useRadar(peek?.ticker ?? "NVDAx");
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pb-16 md:px-10">
      <h1 className="sr-only">Pools board</h1>
      <section aria-label="This week" className="grid gap-6 border-b border-bone/10 py-8 md:grid-cols-[1.25fr_1fr_1fr]">
        <div className="flex flex-col gap-2.5"><span className="text-bone-dim">Waiting in pools</span>
          <Odometer value={usdWhole(waiting)} className="text-[40px] font-medium leading-none tracking-[-0.04em] md:text-[54px]" /></div>
        <div className="flex flex-col gap-2.5"><span className="text-bone-dim">Paid out this week</span>
          <Odometer value={usdWhole(paid)} className="text-[40px] font-medium leading-none tracking-[-0.04em] text-amber md:text-[54px]" /></div>
        <div className="flex flex-col gap-2.5"><span className="text-bone-dim">Next Friday close</span>
          <span className="mono text-[40px] font-medium leading-none tracking-[-0.04em] md:text-[54px]">{countdown(untilClose(now))}</span></div>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {view === "board" ? <PoolsTreemap pools={shown} selectedId={peek?.id} onSelect={setSel} /> : (
            <div className="panel overflow-x-auto p-2.5">
              <table className="w-full text-left"><caption className="sr-only">All pools</caption>
                <thead className="text-bone-dim"><tr><th scope="col" className="p-3 font-medium">Stock</th><th scope="col" className="p-3 font-medium">Side</th>
                  <th scope="col" className="p-3 text-right font-medium">Waiting</th><th scope="col" className="p-3 text-right font-medium">Paid this week</th><th scope="col" className="p-3 text-right font-medium">Your price</th></tr></thead>
                <tbody>{shown.map((p) => (
                  <tr key={p.id} className="border-t border-bone/10">
                    <td className="p-3"><Link href={p.roundKey ? `/round/${p.roundKey}` : "/round/demo"} className="font-semibold hover:text-flame">{p.ticker}</Link></td>
                    <td className="p-3">{p.side === "buyLower" ? "Buy lower" : "Sell higher"}</td>
                    <td className="mono p-3 text-right">{usdWhole(p.waitingUsd)}</td><td className="mono p-3 text-right text-amber">{pct(p.ratePct)}</td>
                    <td className="mono p-3 text-right">{signedPct(p.distancePct)}</td></tr>))}</tbody>
              </table>
            </div>
          )}
          <div className="mt-3"><ExampleNote show={pools.some((p) => p.example)} /></div>
        </div>
        <aside className="flex flex-col gap-5" aria-label="Filters">
          <div className="flex flex-col gap-2"><label htmlFor="stock" className="text-bone-dim">Stock</label>
            <select id="stock" value={stock} onChange={(e) => setStock(e.target.value)}
              className="h-12 rounded-[14px] bg-obsidian-2 px-3 text-bone shadow-[inset_0_0_0_1px_var(--color-hairline)]">
              <option value="all">All stocks</option>{tickers.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <SegmentedControl label="Layout" value={view} onChange={setView} options={[{ value: "board", label: "Board" }, { value: "list", label: "List" }]} />
          {peek && (
            <div className="panel p-5">
              <p className="text-[22px] font-semibold">{peek.ticker}</p>
              <p className="text-bone-dim">{peek.side === "buyLower" ? "Buy lower" : "Sell higher"}</p>
              <dl className="mono mt-4 grid grid-cols-2 gap-y-2 text-[13px]">
                <dt className="text-bone-dim">Waiting</dt><dd className="text-right">{usdWhole(peek.waitingUsd)}</dd>
                <dt className="text-bone-dim">Paid this week</dt><dd className="text-right text-amber">{pct(peek.ratePct)}</dd>
                <dt className="text-bone-dim">Your price</dt><dd className="text-right">{signedPct(peek.distancePct)}</dd></dl>
              <div className="mt-4 flex items-center justify-between gap-3"><span className="text-bone-dim">Risk radar</span><RadarPill snap={radar.snap} state={radar.state} /></div>
            </div>)}
        </aside>
      </div>
    </main>
  );
}
