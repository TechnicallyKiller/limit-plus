import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, mono, sans, sec } from "./tokens";

/** ACT 0, THE WAIT. 0:00 to 0:09. One chart, then the pull back into every token waiting. */
const COLS = 27, ROWS = 34, TILE = 36, GAP = 6;
const rand = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const price = (seed: number, t: number) => {
  let v = 0.5;
  for (let i = 0; i < 3; i++) v += Math.sin(t * (0.6 + i * 0.9) + seed * (i + 1) * 3.1) * (0.12 / (i + 1));
  return v;
};

function MiniChart({ seed, t, w, h, stroke, dash }: { seed: number; t: number; w: number; h: number; stroke: string; dash: string }) {
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) pts.push(`${(i / 24) * w},${h * 0.18 + (1 - price(seed, t - (24 - i) * 0.12)) * h * 0.6}`);
  const dashY = h * 0.18 + 0.62 * h * 0.6;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0 }}>
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth={Math.max(1, w * 0.014)} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={0} x2={w} y1={dashY} y2={dashY} stroke={dash} strokeWidth={Math.max(1, w * 0.012)} strokeDasharray={`${w * 0.05} ${w * 0.04}`} />
    </svg>
  );
}

export const Act0: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
  const fieldW = COLS * (TILE + GAP) - GAP, fieldH = ROWS * (TILE + GAP) - GAP;
  const fit = Math.min(w / fieldW, h / fieldH) * 1.04;
  // 0:00 to 0:04 locked on the single tile, 0:04 to 0:09 pull back with an ease-in
  const startScale = (Math.min(w, h) * 0.62) / TILE;
  const k = interpolate(frame, [sec(4), sec(8.6)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.75, 0, 0.2, 1) });
  const scale = Math.exp(Math.log(startScale) * (1 - k) + Math.log(fit) * k);
  const reveal = interpolate(frame, [sec(4.0), sec(6.5)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const grey = interpolate(frame, [sec(8.95), sec(9.0)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const tiles = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const isCenter = r === cy && c === cx;
    const i = r * COLS + c;
    // tiles appear outward from the centre as the camera pulls back
    const dist = Math.hypot(c - cx, r - cy) / Math.hypot(cx, cy);
    const show = isCenter ? 1 : interpolate(reveal, [dist * 0.75, dist * 0.75 + 0.25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (show <= 0.001) continue;
    const base = rand(i) > 0.5 ? C.volt : C.iris;
    const bg = isCenter ? C.obsidian1 : base;
    tiles.push(
      <div key={i} style={{
        position: "absolute", left: c * (TILE + GAP), top: r * (TILE + GAP), width: TILE, height: TILE, borderRadius: TILE * 0.18,
        background: grey > 0 ? C.obsidian2 : bg, opacity: show, boxShadow: isCenter ? `inset 0 0 0 1px rgba(255,255,255,0.08)` : "inset 0 0 0 1px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        <MiniChart seed={i + 1} t={t * (isCenter ? 1 : 1 + rand(i) * 2)} w={TILE} h={TILE} stroke={isCenter ? C.bone : C.obsidian0} dash={C.flame} />
      </div>,
    );
  }

  const captionOpacity = interpolate(frame, [sec(0.6), sec(1.0), sec(3.4), sec(3.9)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: fieldW, height: fieldH, transform: `translate(-50%, -50%) scale(${scale}) translate(${(fieldW / 2 - (cx * (TILE + GAP) + TILE / 2)) * 0}px, 0)`, transformOrigin: `${cx * (TILE + GAP) + TILE / 2}px ${cy * (TILE + GAP) + TILE / 2}px` }}>
        {tiles}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: h * 0.09, textAlign: "center", fontFamily: sans, fontWeight: 600, fontSize: Math.round(h * 0.03), color: C.bone, opacity: captionOpacity }}>
        You wait for free.
      </div>
      <div style={{ position: "absolute", right: w * 0.05, top: h * 0.05, fontFamily: mono, fontSize: Math.round(h * 0.016), color: C.boneFaint }}>
        {String(Math.floor(t / 60)).padStart(2, "0")}:{String(Math.floor(t % 60)).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};
