import { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { archivo } from "./fonts";
import { C, mono, sans, sec } from "./tokens";

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeIO = (x: number) => { const t = clamp01(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const rand = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Caption in sentence case, bottom of frame. `from`/`to` in absolute film seconds. */
export const Caption: React.FC<{ lines: { from: number; to: number; text: string }[]; abs: number }> = ({ lines, abs }) => {
  const { height } = useVideoConfig();
  const t = abs;
  return (
    <>
      {lines.map((l) => {
        const o = interpolate(t, [l.from, l.from + 0.25, l.to - 0.25, l.to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (o <= 0) return null;
        return (
          <div key={l.text + l.from} style={{ position: "absolute", left: 0, right: 0, bottom: height * 0.085, textAlign: "center", opacity: o, transform: `translateY(${(1 - o) * 8}px)` }}>
            <span style={{ display: "inline-block", padding: `${height * 0.008}px ${height * 0.02}px`, borderRadius: 999, background: "rgba(7,7,10,0.62)", color: C.bone, fontFamily: sans, fontWeight: 600, fontSize: Math.round(height * 0.028) }}>{l.text}</span>
          </div>
        );
      })}
    </>
  );
};

export const LevelClock: React.FC<{ label: string; opacity?: number }> = ({ label, opacity = 1 }) => {
  const { width, height } = useVideoConfig();
  return <div style={{ position: "absolute", right: width * 0.05, top: height * 0.05, fontFamily: mono, fontSize: Math.round(height * 0.017), color: C.boneFaint, opacity }}>{label}</div>;
};

/** The candle. `life` 1 = burning, 0 = out. `slow` scales the flicker clock. */
export const Flame: React.FC<{ size: number; life?: number; slow?: number; glow?: boolean }> = ({ size, life = 1, slow = 1, glow = true }) => {
  const f = useCurrentFrame();
  const t = (f / 30) * slow;
  const flick = 1 + 0.07 * Math.sin(t * 9) + 0.05 * Math.sin(t * 17 + 1.3) + 0.03 * Math.sin(t * 31);
  const sway = Math.sin(t * 5.3) * size * 0.025;
  const s = Math.max(0.0001, life);
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 100 150" style={{ overflow: "visible", opacity: life > 0.01 ? 1 : 0 }}>
      <defs>
        <radialGradient id="halo" cx="50%" cy="62%" r="60%"><stop offset="0" stopColor={C.flame} stopOpacity={0.35 * s} /><stop offset="1" stopColor={C.flame} stopOpacity="0" /></radialGradient>
        <linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={C.flame} /><stop offset="0.55" stopColor={C.amber} /><stop offset="1" stopColor="#FFE9B8" /></linearGradient>
      </defs>
      {glow && <circle cx="50" cy="95" r="95" fill="url(#halo)" />}
      <g transform={`translate(${50 + sway / (size / 100)} 148) scale(${s} ${s * flick}) translate(-50 -148)`}>
        <path d="M50 4 C58 30 86 52 86 96 C86 126 70 146 50 146 C30 146 14 126 14 96 C14 70 34 58 40 34 C44 44 48 46 50 4 Z" fill="url(#fl)" />
        <path d="M50 70 C56 88 66 98 66 116 C66 132 58 142 50 142 C42 142 34 132 34 116 C34 98 46 88 50 70 Z" fill="#FFF6DC" opacity="0.9" />
      </g>
    </svg>
  );
};

/** Wordmark made of dots. Samples real text so it is the same wordmark as the site. */
export interface WDot { hx: number; hy: number; sx: number; sy: number; plus: boolean; delay: number; swirl: number }
export function useWordmarkDots(w: number, h: number, pitch: number): WDot[] | null {
  const [dots, setDots] = useState<WDot[] | null>(null);
  const [handle] = useState(() => delayRender("wordmark dots"));
  useEffect(() => {
    (async () => {
      await archivo.waitUntilDone();
      await document.fonts.load(`900 200px ${archivo.fontFamily}`);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const o = cv.getContext("2d")!;
      o.fillStyle = "#fff"; o.textBaseline = "alphabetic";
      let size = h * 0.7;
      for (let i = 0; i < 12; i++) { o.font = `900 ${size}px ${archivo.fontFamily}`; if (o.measureText("limit+").width <= w * 0.92) break; size *= 0.93; }
      const total = o.measureText("limit+").width, pre = o.measureText("limit").width;
      const m = o.measureText("limit+");
      const x0 = (w - total) / 2, y0 = h / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      o.fillText("limit+", x0, y0);
      const data = o.getImageData(0, 0, w, h).data;
      const out: WDot[] = [];
      let n = 0;
      for (let y = pitch / 2; y < h; y += pitch) for (let x = pitch / 2; x < w; x += pitch) {
        if (data[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] > 128) {
          n++;
          const a = rand(n * 3.1) * Math.PI * 2, r = (0.6 + rand(n * 7.7) * 0.9) * Math.max(w, h) * 0.6;
          out.push({ hx: x, hy: y, sx: w / 2 + Math.cos(a) * r, sy: h / 2 + Math.sin(a) * r, plus: x > x0 + pre - 2, delay: rand(n * 1.7), swirl: (rand(n * 9.3) - 0.5) * 220 });
        }
      }
      setDots(out); continueRender(handle);
    })();
  }, []);
  return dots;
}

export const WordmarkDots: React.FC<{ dots: WDot[]; p: number; pitch: number; plusFlame: number; w: number; h: number; opacity?: number }> = ({ dots, p, pitch, plusFlame, w, h, opacity = 1 }) => (
  <svg width={w} height={h} style={{ position: "absolute", inset: 0, opacity }}>
    {dots.map((d, i) => {
      const k = ease(clamp01((p - d.delay * 0.45) / 0.55));
      const x = d.sx + (d.hx - d.sx) * k + Math.sin(k * Math.PI) * d.swirl;
      const y = d.sy + (d.hy - d.sy) * k + Math.sin(k * Math.PI) * d.swirl * 0.4;
      const col = d.plus && plusFlame > 0 ? C.flame : C.bone;
      return <circle key={i} cx={x} cy={y} r={pitch * (0.2 + 0.14 * k)} fill={col} opacity={0.35 + 0.65 * k} />;
    })}
  </svg>
);

export const Black: React.FC = () => <AbsoluteFill style={{ background: C.obsidian0 }} />;
export { archivo, sec };
