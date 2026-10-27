"use client";
import { arc } from "d3-shape";
import type { RoundView } from "@/lib/types";
import { clock } from "@/lib/format";

/** The round's week as a ring: deposits, bidding, the random-close window, reveal, waiting, exercise. */
export default function CandleRing({ round, now }: { round: RoundView; now: number }) {
  const t = round.ts;
  const start = t.open, end = t.exerciseEnd, span = end - start;
  const ang = (ts: number) => ((Math.min(Math.max(ts, start), end) - start) / span) * Math.PI * 2;
  const R = 112, W = 16;
  const seg = (a: number, b: number, inner = R - W, outer = R) =>
    arc().cornerRadius(6)({ innerRadius: inner, outerRadius: outer, startAngle: ang(a), endAngle: ang(b) }) ?? "";
  const segs = [
    { a: t.open, b: t.bidStart, c: "rgb(237 232 221 / 0.28)", label: "Deposits" },
    { a: t.bidStart, b: t.candleStart, c: "var(--color-bone-faint)", label: "Bidding" },
    { a: t.candleStart, b: t.bidEnd, c: "var(--color-flame)", label: "Random close window" },
    { a: t.bidEnd, b: t.revealEnd, c: "var(--color-amber)", label: "Reveal" },
    { a: t.revealEnd, b: t.expiry, c: "rgb(237 232 221 / 0.12)", label: "Friday close" },
    { a: t.expiry, b: t.exerciseEnd, c: "var(--color-iris)", label: "Settle" },
  ];
  const pos = (ts: number, r: number) => [Math.sin(ang(ts)) * r, -Math.cos(ang(ts)) * r];
  const [hx, hy] = pos(now, R - W - 6);
  const mid = (a: number, b: number) => (a + b) / 2;
  return (
    <figure className="m-0">
      <svg viewBox="-270 -175 540 350" role="img" aria-label="Timeline of this round" className="h-auto w-full max-w-[420px]">
        {segs.map((s) => <path key={s.label} d={seg(s.a, s.b)} fill={s.c} />)}
        {round.cutoffTs && (() => { const [x1, y1] = pos(round.cutoffTs, R + 4), [x2, y2] = pos(round.cutoffTs, R - W - 4);
          return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-bone)" strokeWidth={3} strokeLinecap="round" />; })()}
        <line x1={0} y1={0} x2={hx} y2={hy} stroke="var(--color-bone)" strokeWidth={2} strokeLinecap="round" />
        <circle r={4} fill="var(--color-bone)" />
        {segs.filter((s) => s.b - s.a > span * 0.04 || s.label === "Random close window").map((s) => {
          const [x, y] = pos(mid(s.a, s.b), R + 22);
          const anchor = x > 8 ? "start" : x < -8 ? "end" : "middle";
          return <text key={s.label} x={x} y={y} textAnchor={anchor} fontSize={16} fill="var(--color-bone-dim)" style={{ fontFamily: "var(--font-archivo)" }}>{s.label}</text>;
        })}
      </svg>
      <figcaption className="mono mt-1 text-[13px] text-bone-dim">{round.cutoffTs ? `Closed at ${clock(round.cutoffTs)}` : "The close time stays hidden until bidding ends."}</figcaption>
    </figure>
  );
}
