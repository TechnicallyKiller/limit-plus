import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { C, mono, sans, sec } from "./tokens";

/** ACT 0, THE WAIT. 0:00 to 0:09. One chart, then the pull back into every token waiting. */
const TICKERS = ["NVDAx", "TSLAx", "AAPLx", "MSFTx", "AMZNx", "METAx", "GOOGLx", "COINx", "AMDx", "NFLXx", "SPYx", "QQQx", "PLTRx", "MSTRx", "AVGOx", "ORCLx", "CRMx", "UBERx", "SHOPx", "PYPLx", "INTCx", "BABAx", "DISx", "NKEx", "KOx", "PEPx", "JPMx", "BACx", "Vx", "MAx", "WMTx", "COSTx", "HDx", "LLYx", "UNHx", "JNJx", "PFEx", "XOMx", "CVXx", "BAx", "GEx", "CATx", "SBUXx", "MCDx", "ABNBx", "SNOWx", "CRWDx", "PANWx"];
import logoData from "./logos.json";
const LOGOS = logoData as Record<string, { file: string; aspect: number }>;
const W = 1300, H = 1650, GAP = 10;
const rand = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

interface Leaf { name: string; i: number; x: number; y: number; w: number; h: number }
const leaves: Leaf[] = (() => {
  const root = hierarchy<any>({ children: TICKERS.map((name, i) => ({ name, i, value: 1 / Math.pow(i + 1, 0.95) })) }).sum((d) => d.value ?? 0);
  treemap<any>().tile(treemapSquarify).size([W, H]).paddingInner(GAP)(root);
  return root.leaves().map((l: any) => ({ name: l.data.name, i: l.data.i, x: l.x0, y: l.y0, w: l.x1 - l.x0, h: l.y1 - l.y0 }));
})();
const anchor = leaves.find((l) => l.name === "NVDAx")!;

const price = (seed: number, t: number) => {
  let v = 0.5;
  for (let i = 0; i < 3; i++) v += Math.sin(t * (0.6 + i * 0.9) + seed * (i + 1) * 3.1) * (0.12 / (i + 1));
  return v;
};

function Chart({ seed, t, w, h, stroke }: { seed: number; t: number; w: number; h: number; stroke: string }) {
  const pts: string[] = [];
  for (let i = 0; i <= 28; i++) pts.push(`${(i / 28) * w},${h * 0.3 + (1 - price(seed, t - (28 - i) * 0.12)) * h * 0.4}`);
  const dashY = h * 0.3 + 0.62 * h * 0.4;
  const sw = Math.max(1.5, Math.min(w, h) * 0.012);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0 }}>
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={0} x2={w} y1={dashY} y2={dashY} stroke={C.flame} strokeWidth={sw} strokeDasharray={`${w * 0.045} ${w * 0.035}`} />
    </svg>
  );
}

export const Act0: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const ax = anchor.x + anchor.w / 2, ay = anchor.y + anchor.h / 2;
  const startScale = (Math.min(w, h) * 0.66) / anchor.w;
  const endScale = Math.max(w / W, h / H) * 1.03;
  const k = interpolate(frame, [sec(4), sec(8.7)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.75, 0, 0.2, 1) });
  const scale = Math.exp(Math.log(startScale) * (1 - k) + Math.log(endScale) * k);
  const fx = ax * (1 - k) + (W / 2) * k, fy = ay * (1 - k) + (H / 2) * k;
  const reveal = interpolate(frame, [sec(4.0), sec(6.8)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const colour = interpolate(frame, [sec(4.2), sec(5.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const grey = frame >= sec(8.95);
  const maxDist = Math.max(...leaves.map((l) => Math.hypot(l.x + l.w / 2 - ax, l.y + l.h / 2 - ay)));

  const tiles = leaves.map((l) => {
    const isAnchor = l.name === "NVDAx";
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
    const dist = Math.hypot(cx - ax, cy - ay) / maxDist;
    const show = isAnchor ? 1 : interpolate(reveal, [dist * 0.8, dist * 0.8 + 0.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (show <= 0.001) return null;
    const pigment = l.i % 5 === 1 || l.i % 7 === 3 ? C.iris : C.volt;
    const pig = isAnchor ? C.volt : pigment;
    const bg = grey ? C.obsidian2 : isAnchor ? mix(C.obsidian1, pig, colour) : pig;
    const ink = isAnchor ? mix(C.bone, C.obsidian0, colour) : C.obsidian0;
    const logo = LOGOS[l.name];
    const fs = Math.min(l.w * 0.2, l.h * 0.2, 44);
    const showText = l.w > 110 && l.h > 80;
    const logoH = Math.min(fs * 1.05, l.h * 0.28);
    const logoW = logo ? Math.min(logoH * logo.aspect, l.w * 0.62) : 0;
    const iconLike = logo ? logo.aspect < 1.8 : false;
    const col = grey ? C.boneDim : ink;
    return (
      <div key={l.name} style={{ position: "absolute", left: l.x, top: l.y, width: l.w, height: l.h, borderRadius: Math.min(26, l.w * 0.14), background: bg, opacity: show, overflow: "hidden",
        boxShadow: isAnchor && colour < 0.5 ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "inset 0 0 0 1px rgba(0,0,0,0.18)", transform: `scale(${0.85 + 0.15 * show})` }}>
        <Chart seed={l.i + 1} t={t * (isAnchor ? 1 : 1 + rand(l.i) * 2)} w={l.w} h={l.h} stroke={grey ? C.boneFaint : ink} />
        {showText && (
          <div style={{ position: "absolute", left: l.w * 0.08, top: l.h * 0.08, display: "flex", alignItems: "center", gap: fs * 0.4, color: col, fontFamily: sans, fontWeight: 600, fontSize: fs }}>
            {logo && <div style={{ height: logoH, width: logoW, background: col, WebkitMaskImage: `url(${staticFile(logo.file)})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "left center" }} />}
            {(!logo || iconLike) && !isAnchor ? l.name : null}
          </div>
        )}
      </div>
    );
  });

  const captionOpacity = interpolate(frame, [sec(0.6), sec(1.0), sec(3.4), sec(3.9)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      <div style={{ position: "absolute", left: w / 2 - fx * scale, top: h / 2 - fy * scale, width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>{tiles}</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: h * 0.09, textAlign: "center", fontFamily: sans, fontWeight: 600, fontSize: Math.round(h * 0.03), color: C.bone, opacity: captionOpacity }}>You wait for free.</div>
      <div style={{ position: "absolute", right: w * 0.05, top: h * 0.05, fontFamily: mono, fontSize: Math.round(h * 0.016), color: C.boneFaint }}>
        {String(Math.floor(t / 60)).padStart(2, "0")}:{String(Math.floor(t % 60)).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};

function mix(a: string, b: string, k: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = p(a), [br, bg, bb] = p(b);
  return `rgb(${Math.round(ar + (br - ar) * k)}, ${Math.round(ag + (bg - ag) * k)}, ${Math.round(ab + (bb - ab) * k)})`;
}
