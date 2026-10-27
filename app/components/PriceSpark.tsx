"use client";
import { useEffect, useState } from "react";
import { area, line } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { usd } from "@/lib/format";

export default function PriceSpark({ closes, yourPrice, height = 150 }: { closes: number[]; yourPrice: number; height?: number }) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const m = matchMedia("(max-width: 640px)"); const f = () => setNarrow(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  const width = narrow ? 380 : 960;
  if (closes.length < 2) return <div className="h-[150px] text-bone-dim">Price history is not available yet.</div>;
  const pad = { l: 4, r: narrow ? 70 : 64, t: 12, b: 12 };
  const lo = Math.min(...closes, yourPrice) * 0.995, hi = Math.max(...closes, yourPrice) * 1.005;
  const x = scaleLinear().domain([0, closes.length - 1]).range([pad.l, width - pad.r]);
  const y = scaleLinear().domain([lo, hi]).range([height - pad.b, pad.t]);
  const d = line<number>().x((_, i) => x(i)).y((v) => y(v))(closes) ?? "";
  const a = area<number>().x((_, i) => x(i)).y0(height - pad.b).y1((v) => y(v))(closes) ?? "";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`Last 30 days, your price ${usd(yourPrice)}`}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-bone)" stopOpacity="0.18" /><stop offset="1" stopColor="var(--color-bone)" stopOpacity="0" /></linearGradient>
        <linearGradient id="spark-stroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--color-flame)" /><stop offset="1" stopColor="var(--color-amber)" /></linearGradient>
      </defs>
      <path d={a} fill="url(#spark-fill)" />
      <path d={d} fill="none" stroke="url(#spark-stroke)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={pad.l} x2={width - pad.r} y1={y(yourPrice)} y2={y(yourPrice)} stroke="var(--color-flame)" strokeWidth={1.5} strokeDasharray="5 5" />
      <text x={width - pad.r + 8} y={y(yourPrice) + 4} fontSize={11} fill="var(--color-flame)" className="mono">{usd(yourPrice)}</text>
      <text x={width - pad.r + 8} y={y(closes[closes.length - 1]) + 4} fontSize={11} fill="var(--color-bone-dim)" className="mono">{usd(closes[closes.length - 1])}</text>
    </svg>
  );
}
