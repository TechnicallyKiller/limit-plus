"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { ArrowDown, ArrowUp, Plus } from "@phosphor-icons/react";
import type { PoolView } from "@/lib/types";
import { pct, signedPct } from "@/lib/format";

const PAD = 10, GAP = 8;

function Tile({ p, w, h, selected, onSelect }: { p: PoolView; w: number; h: number; selected?: boolean; onSelect?: (p: PoolView) => void }) {
  const buy = p.side === "buyLower";
  const small = w < 150;
  const roomy = w >= 220;
  const pad = small ? 12 : 18;
  const big = w > 260 && h > 200;
  const rateSize = Math.floor(Math.max(14, Math.min(big ? 88 : 44, (w - pad * 2) / 3.3, h * 0.34)));
  const Icon = buy ? ArrowDown : ArrowUp;
  return (
    <Link href={p.roundKey ? `/round/${p.roundKey}` : "/round/demo"} onMouseEnter={() => onSelect?.(p)} onFocus={() => onSelect?.(p)}
      aria-label={`${p.ticker}, ${buy ? "Buy lower" : "Sell higher"}, paid ${pct(p.ratePct)} this week`}
      className="tile flex h-full w-full min-w-0 flex-col justify-between overflow-hidden text-obsidian-0"
      style={{ padding: pad, background: buy ? "var(--color-volt)" : "var(--color-iris)", borderRadius: "var(--radius-tile)",
        boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.18)", outline: selected ? "2px solid var(--color-flame)" : undefined, outlineOffset: 3 }}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold" style={{ fontSize: big ? 30 : small ? 15 : 18 }}>
          {p.ticker}
          {!small && <span className="sr-only">{buy ? "Buy lower" : "Sell higher"}</span>}
          <Icon size={big ? 22 : 16} weight="regular" aria-hidden="true" />
        </span>
        {!small && (
          <span className="mono inline-flex h-8 w-8 items-center justify-center rounded-full bg-obsidian-0 text-bone" aria-hidden="true"><Plus size={16} /></span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="mono font-semibold leading-[0.9] tracking-[-0.05em]" style={{ fontSize: rateSize }}>{pct(p.ratePct)}</span>
          {!small && h > 110 && <span className="text-[13px] font-medium">paid this week</span>}
        </div>
        {roomy && h > 110 && <span className="mono rounded-full bg-obsidian-0 px-3 py-1.5 text-[13px] text-bone">{signedPct(p.distancePct)}</span>}
      </div>
    </Link>
  );
}

export default function PoolsTreemap({ pools, selectedId, onSelect, height = 580 }: { pools: PoolView[]; selectedId?: string; onSelect?: (p: PoolView) => void; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el); setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const sorted = useMemo(() => [...pools].sort((a, b) => b.waitingUsd - a.waitingUsd), [pools]);
  const mobile = w > 0 && w < 640;
  const leaves = useMemo(() => {
    if (!w || mobile) return [];
    const root = hierarchy<any>({ children: sorted.map((p) => ({ p, value: p.waitingUsd })) }).sum((d) => d.value ?? 0);
    treemap<any>().tile(treemapSquarify).size([w - PAD * 2, height - PAD * 2]).paddingInner(GAP)(root);
    return root.leaves() as any[];
  }, [sorted, w, height, mobile]);
  return (
    <div ref={ref} className="panel p-[10px]" style={{ minHeight: mobile ? undefined : height }}>
      {mobile ? (
        <ul className="grid grid-cols-2 gap-2" style={{ gridAutoRows: "150px" }}>
          {sorted.map((p, i) => (
            <li key={p.id} style={{ gridColumn: i === 0 ? "span 2" : undefined }}><Tile p={p} w={i === 0 ? 340 : 160} h={150} /></li>
          ))}
        </ul>
      ) : (
        <ul className="relative m-0 list-none p-0" style={{ height: height - PAD * 2 }}>
          {leaves.map((l: any) => (
            <li key={l.data.p.id} className="absolute" style={{ left: l.x0, top: l.y0, width: l.x1 - l.x0, height: l.y1 - l.y0 }}>
              <Tile p={l.data.p} w={l.x1 - l.x0} h={l.y1 - l.y0} selected={l.data.p.id === selectedId} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
