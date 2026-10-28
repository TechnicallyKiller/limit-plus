import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { rand } from "./parts";

export interface FireSource { x: number; y: number }
/** Additive particle fire. Deterministic per frame. Sources are points the fire burns up from (a candle wick, or the plus of the wordmark). */
export const Fire: React.FC<{ w: number; h: number; sources: FireSource[]; intensity?: number; height?: number; spread?: number; speed?: number; embers?: boolean; seed?: number }> = ({
  w, h, sources, intensity = 1, height = 300, spread = 60, speed = 1, embers = true, seed = 1,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps) * speed;

  const sprite = useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return c;
  }, []);

  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, w, h);
    if (intensity <= 0.001) return;
    g.globalCompositeOperation = "lighter";
    const N = Math.round(Math.min(1300, 420 + sources.length * 5) * Math.min(1, intensity + 0.15));
    const tint = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    // soft halo behind the flame
    const hs = sources[Math.floor(sources.length / 2)];
    const halo = g.createRadialGradient(hs.x, hs.y - height * 0.3, 0, hs.x, hs.y - height * 0.3, height * 0.9);
    halo.addColorStop(0, `rgba(255,91,34,${0.11 * intensity})`); halo.addColorStop(1, "rgba(255,91,34,0)");
    g.globalAlpha = 1; g.fillStyle = halo; g.fillRect(0, 0, w, h);
    for (let i = 0; i < N; i++) {
      const src = sources[Math.floor(rand(i * 3.17 + seed) * sources.length)];
      const life = 0.55 + rand(i * 1.31) * 0.55;
      const u = (((t / life) + rand(i * 7.13 + seed)) % 1);
      // teardrop envelope: narrow at the wick, fullest low down, pinched to a tip
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08 + 0.05)), 0.85);
      const sway = Math.sin(t * 3.1 + i * 1.7) * 0.5 + Math.sin(t * 6.3 + i * 0.9) * 0.3 + Math.sin(t * 11.7 + i * 2.3) * 0.2;
      const lick = Math.sin(t * 2.3 + src.x * 0.05) * 0.5 + Math.sin(t * 4.7) * 0.3;
      const x = src.x + (rand(i * 5.9) - 0.5) * spread * 1.5 * env + sway * spread * 0.35 * u + lick * spread * 0.5 * u * u;
      const y = src.y - Math.pow(u, 0.85) * height * (0.8 + rand(i * 2.9) * 0.3) * intensity;
      const r = spread * 0.62 * env * (0.6 + rand(i * 4.4) * 0.8) * (0.55 + 0.45 * intensity) * (u < 0.1 ? 0.6 : 1) + 2;
      // warm core only low down, then amber, then flame, no smoky tail
      const col = u < 0.12 ? [255, 206, 120] : u < 0.4 ? [255, 176, 60] : u < 0.72 ? [255, 98, 28] : [230, 52, 18];
      const a = (u < 0.06 ? u / 0.06 : 1 - Math.pow((u - 0.06) / 0.94, 1.5)) * 0.2 * Math.min(1, intensity * 1.2);
      const key = col.join(",");
      let sp = (tintCache as any)[key];
      if (!sp) {
        sp = document.createElement("canvas"); sp.width = sp.height = 128;
        const sg = sp.getContext("2d")!; sg.drawImage(sprite, 0, 0); sg.globalCompositeOperation = "source-in"; sg.fillStyle = tint(col, 1); sg.fillRect(0, 0, 128, 128);
        (tintCache as any)[key] = sp;
      }
      g.globalAlpha = Math.max(0, a);
      g.drawImage(sp, x - r, y - r, r * 2, r * 2);
    }
    if (embers) {
      g.globalAlpha = 1;
      for (let i = 0; i < 46; i++) {
        const src = sources[Math.floor(rand(i * 9.3 + seed) * sources.length)];
        const life = 1.6 + rand(i * 3.1) * 1.8, u = ((t / life) + rand(i * 6.7)) % 1;
        const x = src.x + (rand(i * 1.9) - 0.5) * spread * 2.2 + Math.sin(t * 2 + i) * 30 * u;
        const y = src.y - u * height * 1.5 * intensity;
        g.globalAlpha = (1 - u) * 0.9 * Math.min(1, intensity);
        g.fillStyle = "#FFB547"; g.beginPath(); g.arc(x, y, 2.2 * (1 - u * 0.6), 0, 6.283); g.fill();
      }
    }
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  });
  return <canvas ref={ref} width={w} height={h} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }} />;
};
const tintCache: Record<string, HTMLCanvasElement> = {};
