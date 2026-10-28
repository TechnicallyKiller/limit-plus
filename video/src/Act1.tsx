import { AbsoluteFill, Freeze, interpolate, useCurrentFrame } from "remotion";
import { Act0 } from "./Act0";
import { C, sec } from "./tokens";
import { Flame, WordmarkDots, clamp01, easeIO, useWordmarkDots } from "./parts";

/** 0:09 to 0:15. The hole (silence, one candle) and the turn (the dots become the wordmark). Local frame 0 = 0:09. */
export const Act1: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame(); const t = f / 30;
  const pitch = w < 1200 ? 10 : 9;
  const dots = useWordmarkDots(w, Math.round(h * 0.4), pitch);
  const grid = 1 - clamp01(t / 0.35);                         // the grey field cuts out almost instantly
  const candle = interpolate(t, [0.6, 1.5, 3.3, 3.9], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p = easeIO(clamp01((t - 3.2) / 1.0));                // 12.2 to 13.2: dots rush in
  const plusFlame = clamp01((t - 4.9) / 0.2);                // 13.9: the plus ignites with the drop at 14.0
  const shake = t > 5.0 && t < 5.25 ? Math.sin(t * 160) * 7 * (1 - (t - 5.0) / 0.25) : 0;
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      {grid > 0.01 && <AbsoluteFill style={{ opacity: grid }}><Freeze frame={sec(9) - 1}><Act0 w={w} h={h} /></Freeze></AbsoluteFill>}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: candle }}>
        <Flame size={h * 0.12} slow={1} />
      </AbsoluteFill>
      {dots && p > 0 && (
        <div style={{ position: "absolute", left: 0, top: (h - Math.round(h * 0.4)) / 2, width: w, height: Math.round(h * 0.4), transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
          <WordmarkDots dots={dots} p={p} pitch={pitch} plusFlame={plusFlame} w={w} h={Math.round(h * 0.4)} />
        </div>
      )}
    </AbsoluteFill>
  );
};
