import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import logoData from "./logos.json";
import { C, mono, sans } from "./tokens";
import { Flame, WordmarkDots, clamp01, ease, easeIO, rand, useWordmarkDots } from "./parts";

const NVDA = (logoData as any).NVDAx as { file: string; aspect: number };

/** 0:37 to 0:40. The kick: everything the auction decided arrives in streaks. Local frame 0 = 0:37. */
const RATES = [0.8, 0.74, 0.69, 0.62, 0.55, 0.48];
export const Act3: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const t = useCurrentFrame() / 30;
  const rush = 1 + 1.4 * Math.pow(1 - clamp01(t / 1.2), 2);
  const rowH = h * 0.085, x0 = w * 0.14, rw = w * 0.72, y0 = h * 0.2;
  const planeK = easeIO((t - 1.5) / 0.7);
  const pay = ease((t - 2.1) / 0.7) * 6.2;
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      <AbsoluteFill style={{ transform: `scale(${rush})`, transformOrigin: "50% 50%" }}>
        {RATES.map((r, i) => {
          const k = ease((t - i * 0.12) / 1.1);
          const sx = (rand(i * 3.7) - 0.5) * w * 2.2, sy = (rand(i * 6.1) - 0.5) * h * 1.6;
          const x = x0 + sx * (1 - k), y = y0 + i * (rowH + 10) + (i >= 4 ? h * 0.06 : 0) + sy * (1 - k);
          const win = i < 4;
          const flip = clamp01((t - 0.5 - i * 0.12) / 0.5);
          const trail = (1 - k) * 90;
          return (
            <div key={i}>
              {[3, 2, 1].map((g) => <div key={g} style={{ position: "absolute", left: x - (sx > 0 ? -1 : 1) * trail * g * 0.3, top: y - (sy > 0 ? -1 : 1) * trail * g * 0.15, width: rw, height: rowH, borderRadius: 18, background: C.bone, opacity: (1 - k) * 0.05 * g }} />)}
              <div style={{ position: "absolute", left: x, top: y, width: rw, height: rowH, borderRadius: 18, opacity: win ? 1 : 0.35 + 0.65 * (1 - flip),
                background: flip > 0.5 ? (win ? C.volt : C.obsidian2) : "#15151C", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${rw * 0.05}px` }}>
                <span style={{ fontFamily: mono, fontSize: rowH * 0.28, color: flip > 0.5 ? (win ? C.obsidian0 : C.boneDim) : C.boneFaint }}>{flip > 0.5 ? `Bid ${i + 1}` : "Sealed"}</span>
                <span style={{ fontFamily: mono, fontWeight: 600, fontSize: rowH * 0.5, color: win ? C.obsidian0 : C.bone, opacity: flip > 0.5 ? 1 : 0 }}>{r.toFixed(2)}%</span>
              </div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: x0 - 20, width: rw + 40, top: y0 + 4 * (rowH + 10) - 10 - 4, height: 8, transform: `scaleX(${planeK})`, background: "rgba(237,232,221,0.35)", borderRadius: 4 }} />
        <div style={{ position: "absolute", left: x0, width: rw, top: y0 + 4 * (rowH + 10) + h * 0.012, opacity: planeK, transform: `translateY(${(1 - planeK) * 30}px)`, textAlign: "center", fontFamily: sans, fontWeight: 600, fontSize: h * 0.03, color: C.bone }}>Everyone pays 0.62%</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: h * 0.2, textAlign: "center", opacity: clamp01((t - 2.0) / 0.3) }}>
        <div style={{ fontFamily: sans, fontSize: h * 0.022, color: C.boneDim }}>You get paid now</div>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: h * 0.085, color: C.amber, letterSpacing: "-0.04em" }}>${pay.toFixed(2)}</div>
      </div>
      <AbsoluteFill style={{ background: C.bone, opacity: 0.5 * Math.max(0, 1 - t / 0.15) }} />
    </AbsoluteFill>
  );
};

const price = (seed: number, t: number) => { let v = 0.5; for (let i = 0; i < 3; i++) v += Math.sin(t * (0.6 + i * 0.9) + seed * (i + 1) * 3.1) * (0.12 / (i + 1)); return v; };

/** The opening tile again. `wob` > 0 makes the price hover and wobble at the dashed line (the totem). */
export const HeroTile: React.FC<{ w: number; h: number; t: number; wob?: number; amberLabel?: boolean; scale?: number; y?: number; pad?: number }> = ({ w, h, t, wob = 0, amberLabel = false, scale = 1, y = 0 }) => {
  const tw = Math.min(w, h) * 0.66 * scale, th = tw * 0.92;
  const dashY = th * 0.58;
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const tt = t - (40 - i) * 0.12;
    const base = th * 0.3 + (1 - price(1, tt)) * th * 0.4;
    const hover = wob > 0 ? dashY - th * 0.02 + Math.sin(tt * 7) * th * 0.022 * wob : base;
    const mixk = wob > 0 ? clamp01(i / 40) : 0;
    pts.push(`${(i / 40) * tw},${base * (1 - mixk) + hover * mixk}`);
  }
  return (
    <div style={{ position: "absolute", left: (w - tw) / 2, top: (h - th) / 2 + y, width: tw, height: th, borderRadius: tw * 0.05, background: C.obsidian1, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: tw * 0.08, top: th * 0.09, height: tw * 0.062, width: tw * 0.062 * NVDA.aspect, background: C.bone, WebkitMaskImage: `url(${staticFile(NVDA.file)})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "left center" }} />
      <svg width={tw} height={th} style={{ position: "absolute", inset: 0 }}>
        <polyline points={pts.join(" ")} fill="none" stroke={C.bone} strokeWidth={Math.max(3, tw * 0.012)} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={0} x2={tw} y1={dashY} y2={dashY} stroke={amberLabel ? C.amber : C.flame} strokeWidth={Math.max(3, tw * 0.012)} strokeDasharray={`${tw * 0.045} ${tw * 0.035}`} />
      </svg>
      {amberLabel && <div style={{ position: "absolute", right: tw * 0.05, top: dashY + th * 0.03, fontFamily: mono, fontWeight: 500, fontSize: tw * 0.06, color: C.amber }}>+ $6.20</div>}
    </div>
  );
};

/** 0:40 to 0:51. Two Fridays, then the totem. Local frame 0 = 0:40. */
export const Act4: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const t = useCurrentFrame() / 30;
  const portrait = h > w;
  const seam = easeIO((t - 0.3) / 0.6);
  const halfW = portrait ? w : w / 2, halfH = portrait ? h / 2 : h;
  const Half: React.FC<{ idx: number }> = ({ idx }) => {
    const falls = idx === 0;
    const ox = portrait ? 0 : idx * halfW, oy = portrait ? idx * halfH : 0;
    const k = easeIO((t - 0.5) / 1.5);
    const tw = Math.min(halfW, halfH) * 0.6, th = tw * 0.62;
    const lineY = th * 0.35 + (falls ? k * th * 0.42 : -k * th * 0.06);
    const dashY = th * 0.58;
    const chip = ease((t - (falls ? 2.2 : 3.0)) / 0.8);
    return (
      <div style={{ position: "absolute", left: ox, top: oy, width: halfW, height: halfH }}>
        <div style={{ position: "absolute", left: (halfW - tw) / 2, top: halfH * 0.085, fontFamily: sans, fontSize: halfH * 0.05, color: C.boneDim }}>Friday close</div>
        <div style={{ position: "absolute", right: (halfW - tw) / 2, top: halfH * 0.05, fontFamily: mono, fontSize: halfH * 0.085, color: C.bone }}>${(falls ? 180 - k * 15 : 180 + k * 5).toFixed(2)}</div>
        <div style={{ position: "absolute", left: (halfW - tw) / 2, top: halfH * 0.2, width: tw, height: th, borderRadius: 20, background: C.obsidian1, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <svg width={tw} height={th}>
            <line x1={0} x2={tw} y1={dashY} y2={dashY} stroke={C.flame} strokeWidth={4} strokeDasharray="14 10" />
            <polyline points={`0,${th * 0.3} ${tw * 0.3},${th * 0.33} ${tw * 0.6},${th * 0.3 + (lineY - th * 0.3) * 0.7} ${tw},${lineY}`} fill="none" stroke={C.bone} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ position: "absolute", left: (halfW - tw) / 2, width: tw, top: halfH * 0.2 + th + halfH * 0.04, opacity: chip, transform: `translateY(${(1 - chip) * 24}px)`, textAlign: "center",
          fontFamily: sans, fontWeight: 600, fontSize: halfH * 0.06, color: falls ? C.obsidian0 : C.bone, background: falls ? C.volt : C.obsidian2, borderRadius: 999, padding: `${halfH * 0.018}px 0` }}>
          {falls ? "5.84 NVDAx at your price" : "Your money back"}
        </div>
      </div>
    );
  };
  const split = 1 - clamp01((t - 6.0) / 0.5);
  const amber = clamp01((t - 3.8) / 0.5);
  const heroIn = clamp01((t - 6.2) / 0.4);
  const wob = clamp01((t - 6.6) / 1.0);
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      {split > 0.01 && (
        <AbsoluteFill style={{ opacity: split, transform: `scale(${0.6 + 0.4 * split})` }}>
          <Half idx={0} /><Half idx={1} />
          <div style={{ position: "absolute", background: C.flame, ...(portrait ? { left: w * 0.5 - (w * 0.9 * seam) / 2, width: w * 0.9 * seam, top: h / 2 - 1.5, height: 3 } : { top: h * 0.5 - (h * 0.9 * seam) / 2, height: h * 0.9 * seam, left: w / 2 - 1.5, width: 3 }) }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: portrait ? h / 2 - h * 0.028 : h * 0.86, textAlign: "center", opacity: amber }}>
            <span style={{ display: "inline-block", padding: `${h * 0.012}px ${h * 0.03}px`, borderRadius: 999, background: C.obsidian0, boxShadow: `inset 0 0 0 2px ${C.amber}`, fontFamily: sans, fontWeight: 600, fontSize: h * 0.03, color: C.amber }}>+ the $6.20 you were paid</span>
          </div>
        </AbsoluteFill>
      )}
      {heroIn > 0.01 && t < 9.5 && <AbsoluteFill style={{ opacity: heroIn }}><HeroTile w={w} h={h} t={t} wob={wob} /></AbsoluteFill>}
    </AbsoluteFill>
  );
};

/** 0:51 to 1:00. The loop closes, then the wordmark. Local frame 0 = 0:51. */
export const Coda: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const t = useCurrentFrame() / 30;
  const pitch = w < 1200 ? 10 : 9;
  const wh = Math.round(h * 0.4);
  const dots = useWordmarkDots(w, wh, pitch);
  const back = t >= 1.6 && t < 4.0;
  const final = t >= 4.0;
  const shake = t > 4.0 && t < 4.25 ? Math.sin(t * 160) * 6 * (1 - (t - 4.0) / 0.25) : 0;
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      {back && <HeroTile w={w} h={h} t={t} amberLabel />}
      {final && (
        <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(237,232,221,0.075) 1px, transparent 1.6px)", backgroundSize: "24px 24px" }}>
          {dots && <div style={{ position: "absolute", left: 0, top: h * 0.2, width: w, height: wh, transform: `translate(${shake}px, ${shake * 0.5}px)` }}><WordmarkDots dots={dots} p={1} pitch={pitch} plusFlame={1} w={w} h={wh} /></div>}
          <div style={{ position: "absolute", left: 0, right: 0, top: h * 0.2 + wh + h * 0.03, textAlign: "center", opacity: clamp01((t - 4.6) / 0.6), fontFamily: sans, fontWeight: 600, fontSize: h * 0.034, color: C.bone }}>Name your price. Get paid while you wait.</div>
          <div style={{ position: "absolute", left: w * 0.08, right: w * 0.08, bottom: h * 0.06, textAlign: "center", opacity: clamp01((t - 5.6) / 0.6), fontFamily: sans, fontSize: h * 0.0145, lineHeight: 1.5, color: C.boneDim }}>
            Live on Solana. Prices from Pyth. Example numbers shown.<br />Company names and logos are trademarks of their owners. Not affiliated with or endorsed by them.
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
