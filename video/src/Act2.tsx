import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, mono, sans } from "./tokens";
import { Flame, LevelClock, clamp01, ease, easeIO, rand } from "./parts";

/** 0:15 to 0:37. Three levels, each slower than the last: one week, one auction, one moment. Local frame 0 = 0:15. */
const arcPath = (cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) => {
  const p = (r: number, a: number) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
};
const SEGS: [number, number, string][] = [
  [0, 0.14, "rgba(237,232,221,0.28)"], [0.14, 0.30, C.boneFaint], [0.30, 0.36, C.flame], [0.36, 0.44, C.amber], [0.44, 0.86, "rgba(237,232,221,0.12)"], [0.86, 1, C.iris],
];

const Level1: React.FC<{ w: number; h: number; t: number }> = ({ w, h, t }) => {
  const cx = w / 2, cy = h * 0.34, R = Math.min(w, h) * 0.3, W = R * 0.11;
  const sweep = clamp01((t - 0.8) / 4.0) * Math.PI * 2;
  const knob = easeIO((t - 2.0) / 3.0);
  const price = 180 - 9 * knob;
  const pay = ease((t - 5.0) / 2.4) * 6.2;
  const trackY = h * 0.66, trackX0 = w * 0.12, trackX1 = w * 0.88;
  const dots = Array.from({ length: 26 }, (_, i) => i);
  const wallet = [w * 0.84, h * 0.84];
  const flameAngle = 0.33 * Math.PI * 2;
  const fx = cx + Math.sin(flameAngle) * (R - W / 2), fy = cy - Math.cos(flameAngle) * (R - W / 2);
  const zoom = easeIO((t - 9.2) / 1.0);
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + zoom * 5}) `, transformOrigin: `${fx}px ${fy}px`, opacity: 1 - clamp01((t - 9.5) / 0.7) }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        {SEGS.map(([a, b, c], i) => {
          const a0 = a * Math.PI * 2, a1 = Math.min(b * Math.PI * 2, sweep);
          return a1 > a0 ? <path key={i} d={arcPath(cx, cy, R - W, R, a0, a1)} fill={c} /> : null;
        })}
        <line x1={cx} y1={cy} x2={cx + Math.sin(sweep) * (R - W - 8)} y2={cy - Math.cos(sweep) * (R - W - 8)} stroke={C.bone} strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill={C.bone} />
        {/* slider */}
        <line x1={trackX0} x2={trackX1} y1={trackY} y2={trackY} stroke={C.obsidian3} strokeWidth={6} strokeLinecap="round" opacity={clamp01((t - 1.6) / 0.5)} />
        <line x1={trackX0} x2={trackX0 + (trackX1 - trackX0) * (0.2 + 0.4 * knob)} y1={trackY} y2={trackY} stroke={C.bone} strokeWidth={6} strokeLinecap="round" opacity={clamp01((t - 1.6) / 0.5)} />
        <circle cx={trackX0 + (trackX1 - trackX0) * (0.2 + 0.4 * knob)} cy={trackY} r={20} fill={C.bone} opacity={clamp01((t - 1.6) / 0.5)} />
        {/* wallet */}
        <g opacity={clamp01((t - 6.6) / 0.5)} transform={`translate(${wallet[0] - 44} ${wallet[1] - 32})`}>
          <rect width={88} height={64} rx={14} fill={C.obsidian2} stroke={C.boneFaint} strokeWidth={2} />
          <rect x={56} y={22} width={32} height={20} rx={8} fill={C.obsidian3} stroke={C.boneFaint} strokeWidth={2} />
          <circle cx={72} cy={32} r={3.5} fill={C.amber} />
        </g>
        {dots.map((i) => {
          const k = ease((t - 7.0 - i * 0.07) / 1.0);
          if (k <= 0 || k >= 1) return null;
          const x0 = w * 0.62, y0 = h * 0.8, x = x0 + (wallet[0] - x0) * k, y = y0 + (wallet[1] - y0) * k - Math.sin(k * Math.PI) * 70;
          return <circle key={i} cx={x} cy={y} r={7} fill={C.amber} opacity={1 - k * 0.3} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: trackX0, top: trackY - h * 0.065, fontFamily: sans, fontSize: h * 0.022, color: C.boneDim, opacity: clamp01((t - 1.6) / 0.5) }}>Your price</div>
      <div style={{ position: "absolute", right: w * 0.12, top: trackY - h * 0.07, fontFamily: mono, fontSize: h * 0.03, color: C.bone, opacity: clamp01((t - 1.6) / 0.5) }}>${price.toFixed(2)}</div>
      <div style={{ position: "absolute", left: w * 0.12, top: h * 0.74, opacity: clamp01((t - 4.8) / 0.5) }}>
        <div style={{ fontFamily: sans, fontSize: h * 0.022, color: C.boneDim }}>You get paid now</div>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: h * 0.075, color: C.amber, letterSpacing: "-0.04em" }}>${pay.toFixed(2)}</div>
      </div>
      <LevelClock label="1 week" />
    </AbsoluteFill>
  );
};

const ADDR = ["9fQ2...a1Lm", "Ht7c...9wPe", "Bq4r...s0Na", "Lm8v...e3Tx", "Cz1k...h6Ru", "Wd5n...q8Jb", "Pk2s...m4Zy"];
export const Level2: React.FC<{ w: number; h: number; t: number }> = ({ w, h, t }) => {
  const cw = Math.min(w, h) * 0.2, ch = cw * 1.4;
  const drift = Math.sin(t * 0.45) * 7;
  return (
    <AbsoluteFill style={{ perspective: 1400, perspectiveOrigin: "50% 45%" }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `translateZ(${t * 18}px) rotateX(8deg) rotateY(${drift}deg)` }}>
        <div style={{ position: "absolute", left: -w, right: -w, top: h * 0.62, height: h * 2, transform: "rotateX(72deg)", transformOrigin: "50% 0", backgroundImage: "radial-gradient(rgba(237,232,221,0.16) 2px, transparent 2.6px)", backgroundSize: "56px 56px" }} />
        {ADDR.map((a, i) => {
          const x = (rand(i * 5.3) - 0.5) * w * 0.9, z = -rand(i * 2.9) * 380, yRest = h * (0.3 + rand(i * 8.1) * 0.22);
          const delay = i * 0.38, k = ease((t - delay) / 1.1);
          const bob = Math.sin(t * 0.8 + i) * 8;
          return (
            <div key={a} style={{ position: "absolute", left: w / 2 + x - cw / 2, top: yRest + bob - (1 - k) * h, width: cw, height: ch, transform: `translateZ(${z}px) rotateY(${(rand(i) - 0.5) * 26}deg)`, opacity: clamp01(k * 3),
              borderRadius: 22, background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04)), #15151C",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08), 0 30px 60px -20px rgba(0,0,0,0.9)" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 22, backgroundImage: "repeating-linear-gradient(135deg, rgba(237,232,221,0.07) 0 1px, transparent 1px 7px)" }} />
              <div style={{ position: "absolute", left: cw * 0.1, top: ch * 0.07, fontFamily: mono, fontSize: cw * 0.095, color: C.boneDim }}>{a}</div>
              <div style={{ position: "absolute", left: cw * 0.1, top: ch * 0.15, fontFamily: mono, fontSize: cw * 0.08, color: C.boneFaint }}>Sealed</div>
            </div>
          );
        })}
      </div>
      <LevelClock label="1 auction" />
    </AbsoluteFill>
  );
};

const Level3: React.FC<{ w: number; h: number; t: number }> = ({ w, h, t }) => {
  const out = t >= 5.0;                                        // 0:36.0, the candle goes out
  const life = out ? clamp01(1 - (t - 5.0) / 0.1) : 1;
  const embers = Array.from({ length: 22 }, (_, i) => i);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${1 + t * 0.03})` }}><Flame size={h * 0.32} life={life} slow={0.14} /></div>
      {!out && embers.map((i) => {
        const cyc = ((t * 0.18 + rand(i * 3.3)) % 1), x = w / 2 + (rand(i * 1.9) - 0.5) * w * 0.28 + Math.sin(cyc * 6 + i) * 20, y = h * 0.52 - cyc * h * 0.34;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 5, height: 5, borderRadius: 5, background: C.amber, opacity: (1 - cyc) * 0.8 }} />;
      })}
      <LevelClock label="1 moment" opacity={out ? 0 : 1} />
    </AbsoluteFill>
  );
};

export const Act2: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const t = useCurrentFrame() / 30;
  const l2 = clamp01((t - 9.6) / 0.8) * (1 - clamp01((t - 15.2) / 0.8));
  const l3 = clamp01((t - 15.4) / 0.8);
  const s2 = 0.6 + 0.4 * ease((t - 9.6) / 0.8) + (t > 15.2 ? 1.4 * easeIO((t - 15.2) / 0.8) : 0);
  const s3 = 0.6 + 0.4 * ease((t - 15.4) / 0.8);
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      {t < 10.4 && <Level1 w={w} h={h} t={t} />}
      {l2 > 0.001 && <AbsoluteFill style={{ opacity: l2, transform: `scale(${s2})` }}><Level2 w={w} h={h} t={t - 9.6} /></AbsoluteFill>}
      {l3 > 0.001 && <AbsoluteFill style={{ opacity: l3, transform: `scale(${s3})` }}><Level3 w={w} h={h} t={t - 16.0} /></AbsoluteFill>}
    </AbsoluteFill>
  );
};
