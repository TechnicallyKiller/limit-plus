"use client";
import { useMemo, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { BidView, RoundView } from "@/lib/types";
import { pct, shortKey } from "@/lib/format";

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

/** Rate in percent of the order size, per week: what the mockups show on every card. */
const rateOf = (b: BidView, r: RoundView) => (b.pricePerContract !== undefined ? (b.pricePerContract / (r.yourPrice * r.sharesPerContract)) * 100 : undefined);

export default function AuctionStage({ round }: { round: RoundView }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0), py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-1, 1], [6, -6]), spring), ry = useSpring(useTransform(px, [-1, 1], [-6, 6]), spring);
  const revealed = ["reveal", "awaitingClear", "cleared", "awaitingSettle", "exercise", "awaitingFinalize", "finalized", "noSale"].includes(round.phase);
  const cleared = ["cleared", "awaitingSettle", "exercise", "awaitingFinalize", "finalized"].includes(round.phase);
  const cutoff = round.cutoffTs;
  const late = (b: BidView) => cutoff !== undefined && b.commitTs > cutoff;
  const ladder = useMemo(() => [...round.bids].filter((b) => b.revealed && !late(b)).sort((a, b) => (b.pricePerContract ?? 0) - (a.pricePerContract ?? 0)), [round.bids, cutoff]); // eslint-disable-line
  const best = ladder[0] ? rateOf(ladder[0], round) : undefined;
  const clearingRate = round.clearingPerContract !== undefined ? (round.clearingPerContract / (round.yourPrice * round.sharesPerContract)) * 100 : undefined;

  const place = (b: BidView, i: number) => {
    const h = hash(b.bidder);
    const free = { x: ((h % 1000) / 1000 - 0.5) * 600, y: (((h >> 10) % 1000) / 1000 - 0.5) * 70, z: (((h >> 20) % 1000) / 1000) * 70 - 30 };
    if (cleared && b.revealed && !late(b)) {
      const idx = ladder.indexOf(b);
      return { x: -230 + (idx % 3) * 0, y: -150 + idx * 34, z: 0 - idx * 4 };
    }
    if (revealed && late(b)) return { x: free.x, y: free.y + 30, z: -120 };
    return free;
  };
  const planeIdx = ladder.findIndex((b) => b.wonQty === undefined) ;

  if (reduced) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden="true">
        {round.bids.map((b) => (
          <div key={b.bidder} className="glass p-4" style={{ borderRadius: "var(--radius-tile)", opacity: revealed && late(b) ? 0.4 : 1 }}>
            <p className="mono text-[13px] text-bone-dim">{shortKey(b.bidder)}</p>
            <p className="mono mt-3 text-[24px]">{revealed && b.revealed ? `${pct(rateOf(b, round) ?? 0)}` : "Sealed"}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} aria-hidden="true" className="dotfield relative h-[420px] overflow-hidden rounded-[18px]" style={{ perspective: 1400 }}
      onPointerMove={(e) => { const r = ref.current!.getBoundingClientRect(); px.set(((e.clientX - r.left) / r.width) * 2 - 1); py.set(((e.clientY - r.top) / r.height) * 2 - 1); }}
      onPointerLeave={() => { px.set(0); py.set(0); }}>
      <motion.div className="absolute inset-0" style={{ transformStyle: "preserve-3d", rotateX: rx, rotateY: ry }}>
        {round.bids.map((b, i) => {
          const p = place(b, i);
          const faceUp = revealed && b.revealed;
          const after = revealed && late(b);
          const winner = cleared && b.wonQty !== undefined;
          return (
            <motion.div key={b.bidder} className="absolute left-1/2 top-1/2 p-3" initial={{ opacity: 0, y: p.y - 205, x: p.x - 75 }}
              animate={{ opacity: after || (cleared && !winner) ? 0.4 : 1, x: p.x - (cleared ? 95 : 75), y: p.y - (cleared ? 14 : 105), z: p.z, rotateY: faceUp ? 180 : 0 }}
              transition={{ ...spring, delay: i * 0.12 }}
              style={{ width: cleared ? 190 : 150, height: cleared ? 28 : 210, borderRadius: "var(--radius-tile)", transformStyle: "preserve-3d",
                background: winner ? "var(--color-volt)" : "linear-gradient(180deg, rgb(255 255 255 / 0.10), rgb(255 255 255 / 0.04)), var(--color-obsidian-2)",
                color: winner ? "var(--color-obsidian-0)" : undefined,
                boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.18), inset 0 -1px 0 rgb(0 0 0 / 0.4), 0 0 0 1px rgb(255 255 255 / 0.08), 0 18px 40px -18px rgb(0 0 0 / 0.8)" }}>
              <div style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0, padding: 12, borderRadius: "inherit",
                backgroundImage: "repeating-linear-gradient(135deg, rgb(237 232 221 / 0.07) 0 1px, transparent 1px 6px)" }}>
                <p className="mono text-[12px] text-bone-dim">{shortKey(b.bidder)}</p>
                <p className="mono mt-1 text-[11px] text-bone-faint">Sealed</p>
              </div>
              <div style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", inset: 0, padding: 12, borderRadius: "inherit" }}>
                <p className="mono text-[11px] opacity-70">{shortKey(b.bidder)}</p>
                <p className="mono text-[26px] font-medium leading-tight">{pct(rateOf(b, round) ?? 0)}</p>
                {!cleared && <p className="text-[11px] opacity-70">a week</p>}
                {after && <p className="mt-2 text-[11px]">After the close</p>}
              </div>
            </motion.div>
          );
        })}
        {cleared && clearingRate !== undefined && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass absolute left-1/2 top-1/2 flex items-center justify-center px-6 py-2 text-[14px]"
            style={{ width: 520, translateX: "-50%", translateY: planeIdx >= 0 ? -150 + planeIdx * 34 - 118 : 40, borderRadius: "var(--radius-tile)" }}>
            Everyone pays {pct(clearingRate)} a week
          </motion.div>
        )}
      </motion.div>
      <p className="absolute bottom-3 left-4 mono text-[12px] text-bone-dim">{best !== undefined ? `Best bid ${pct(best)} a week` : `${round.bids.length} sealed bids`}</p>
    </div>
  );
}
