import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Act4, HeroTile } from "./Act3";
import { Chart, LOGOS, leaves, mix } from "./Act0";
import { Fire } from "./Fire";
import { WordmarkDots, clamp01, ease, easeIO, rand, useWordmarkDots } from "./parts";
import { C, mono, sans } from "./tokens";

/** v2 INTRO. 120 BPM: 1 beat = 15 frames, 1 bar = 60 frames. Bars are 1-based like the script. */
const BEAT = 15, BAR = 60;
const bar = (n: number, beat = 0) => (n - 1) * BAR + beat * BEAT;

const shake = (f: number, at: number, dur = 10, amp = 14): [number, number] => {
  const k = f - at; if (k < 0 || k > dur) return [0, 0];
  const d = 1 - k / dur; return [Math.sin(k * 5.1) * amp * d, Math.cos(k * 4.3) * amp * 0.7 * d];
};
/** Punch-in entrance: scale and blur settle over a few frames after `at`. */
const punch = (f: number, at: number, from = 1.5, frames = 6) => {
  const k = clamp01((f - at) / frames), e = 1 - Math.pow(1 - k, 3);
  return { scale: from + (1 - from) * e, blur: (1 - e) * 14, opacity: f >= at ? 1 : 0 };
};
const flash = (f: number, at: number, dur = 4, a = 0.9) => (f >= at && f < at + dur ? a * (1 - (f - at) / dur) : 0);

/* ---------- devices with real UI ---------- */
const Laptop: React.FC<{ src: string; w: number }> = ({ src, w }) => (
  <div style={{ width: w, borderRadius: w * 0.022, padding: w * 0.012, background: "linear-gradient(180deg,#23232D,#15151C)", boxShadow: "0 0 0 1.5px rgba(255,255,255,0.1), 0 50px 90px -30px rgba(0,0,0,0.95)" }}>
    <Img src={staticFile(src)} style={{ width: "100%", display: "block", borderRadius: w * 0.012 }} />
  </div>
);
const Phone: React.FC<{ src: string; w: number }> = ({ src, w }) => (
  <div style={{ width: w, borderRadius: w * 0.14, padding: w * 0.035, background: "linear-gradient(180deg,#2a2a34,#15151C)", boxShadow: "0 0 0 1.5px rgba(255,255,255,0.12), 0 50px 90px -20px rgba(0,0,0,0.95)" }}>
    <Img src={staticFile(src)} style={{ width: "100%", display: "block", borderRadius: w * 0.11 }} />
  </div>
);

const Word: React.FC<{ text: string; at: number; f: number; size: number; color?: string; x?: number; y?: number }> = ({ text, at, f, size, color = C.bone, x = 0, y = 0 }) => {
  const p = punch(f, at, 1.7, 7);
  if (p.opacity === 0) return null;
  return <div style={{ position: "absolute", left: x, top: y, transform: `scale(${p.scale})`, transformOrigin: "0 100%", filter: `blur(${p.blur}px)`, fontFamily: sans, fontWeight: 900, fontStretch: "125%", fontSize: size, lineHeight: 0.9, letterSpacing: "-0.04em", color, whiteSpace: "nowrap" }}>{text}</div>;
};

/* ---------- S1 hook: bars 1-3 ---------- */
const Hook: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();
  const hits = [0, 15, 60, 90, 120, 135];
  const [sx, sy] = hits.reduce<[number, number]>((a, at) => { const s = shake(f, at, 8, 12); return [a[0] + s[0], a[1] + s[1]]; }, [0, 0]);
  const fl = hits.reduce((a, at) => Math.max(a, flash(f, at, 3, 0.35)), 0);
  const tint = (Math.floor(f / 15) % 2 === 0) ? C.volt : C.iris;
  const size = w * 0.2, s2 = size * 0.62, y0 = h * 0.17;
  return (
    <AbsoluteFill style={{ background: C.obsidian0, transform: `translate(${sx}px, ${sy}px)` }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(237,232,221,0.09) 1px, transparent 1.6px)", backgroundSize: "24px 24px" }} />
      <AbsoluteFill style={{ background: tint, opacity: fl }} />
      <Word text="Get" at={0} f={f} size={size} x={w * 0.06} y={y0} />
      <Word text="paid" at={15} f={f} size={size} x={w * 0.06} y={y0 + size * 0.98} color={C.amber} />
      <Word text="while you" at={60} f={f} size={s2} x={w * 0.06} y={y0 + size * 2.15} />
      <Word text="wait." at={90} f={f} size={s2} x={w * 0.06} y={y0 + size * 2.15 + s2 * 1.0} color={C.flame} />
      <div style={{ position: "absolute", left: w * 0.06, top: h * 0.06, opacity: clamp01(f / 8), transform: `translateX(${(1 - ease(f / 10)) * -40}px)` }}>
        <div style={{ width: w * 0.08, height: 3, background: C.flame, marginBottom: 14 }} />
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: h * 0.034, color: C.bone }}>Divyanshh</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- S2 token slam: bars 4-5 ---------- */
const TileSlam: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();
  const W = 1300, H = 1650;
  const end = Math.max(w / W, h / H) * 1.03, startS = end * 2.4;
  const kk = 1 - Math.pow(1 - clamp01(f / 110), 3);
  const scale = startS + (end - startS) * kk;
  const a0 = leaves.find((l) => l.name === "NVDAx")!;
  const fx = (a0.x + a0.w / 2) * (1 - kk) + (W / 2) * kk, fy = (a0.y + a0.h / 2) * (1 - kk) + (H / 2) * kk;
  const [sx, sy] = [0, 15, 30, 45, 60, 75, 90, 105].reduce<[number, number]>((a, at) => { const s = shake(f, at, 6, 9); return [a[0] + s[0], a[1] + s[1]]; }, [0, 0]);
  const at = (i: number) => (i < 8 ? i * 7.5 : 60 + (i - 8) * 1.1);
  return (
    <AbsoluteFill style={{ background: C.obsidian0, transform: `translate(${sx}px,${sy}px)` }}>
      <div style={{ position: "absolute", left: w / 2 - fx * scale, top: h / 2 - fy * scale, width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        {leaves.map((l) => {
          const k = clamp01((f - at(l.i)) / 5); if (k <= 0) return null;
          const e = 1 - Math.pow(1 - k, 3);
          const pig = l.i % 5 === 1 || l.i % 7 === 3 ? C.iris : C.volt;
          const logo = (LOGOS as any)[l.name];
          const fs = Math.min(l.w * 0.2, l.h * 0.2, 44);
          const logoH = Math.min(fs * 1.05, l.h * 0.28), logoW = logo ? Math.min(logoH * logo.aspect, l.w * 0.62) : 0;
          return (
            <div key={l.name} style={{ position: "absolute", left: l.x, top: l.y, width: l.w, height: l.h, borderRadius: Math.min(26, l.w * 0.14), background: f - at(l.i) < 2 ? "#fff" : pig, transform: `scale(${1.35 - 0.35 * e})`, opacity: e, overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)" }}>
              <Chart seed={l.i + 1} t={f / 30 * (1 + rand(l.i) * 2)} w={l.w} h={l.h} stroke={C.obsidian0} />
              {l.w > 110 && l.h > 80 && <div style={{ position: "absolute", left: l.w * 0.08, top: l.h * 0.08, display: "flex", alignItems: "center", gap: fs * 0.4, color: C.obsidian0, fontFamily: sans, fontWeight: 600, fontSize: fs }}>
                {logo && <div style={{ height: logoH, width: logoW, background: C.obsidian0, WebkitMaskImage: `url(${staticFile(logo.file)})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "left center" }} />}
                {(!logo || logo.aspect < 1.8) ? l.name : null}
              </div>}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ---------- S3 story: bars 6-8 ---------- */
const Story: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f0 = useCurrentFrame();
  const FREEZE = 150;                                         // bar 8 beat 3
  const f = Math.min(f0, FREEZE);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const day = Math.min(4, Math.floor((f / FREEZE) ** 1.6 * 5));
  const grey = clamp01((f - 40) / 100);
  const ramp = f / 30 * (1 + f / 60);
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      <AbsoluteFill style={{ filter: `grayscale(${grey})` }}>
        <HeroTile w={w} h={h} t={ramp} y={-h * 0.03} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: h * 0.1, textAlign: "center", fontFamily: mono, fontSize: h * 0.09, color: C.bone, letterSpacing: "-0.04em" }}>{days[day]}</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: h * 0.2, textAlign: "center" }}>
        <div style={{ fontFamily: sans, fontSize: h * 0.022, color: C.boneDim }}>You get paid now</div>
        <div style={{ fontFamily: mono, fontSize: h * 0.085, color: C.boneFaint, letterSpacing: "-0.04em" }}>$0.00</div>
      </div>
      {f0 >= FREEZE && <AbsoluteFill style={{ background: C.bone, opacity: flash(f0, FREEZE, 3, 0.25) }} />}
    </AbsoluteFill>
  );
};

/* ---------- S4 and S8 wordmark stomp with fire ---------- */
const Stomp: React.FC<{ w: number; h: number; stompAt: number }> = ({ w, h, stompAt }) => {
  const f = useCurrentFrame();
  const pitch = 10, wh = Math.round(h * 0.4);
  const dots = useWordmarkDots(w, wh, pitch);
  const conv = easeIO(clamp01(f / stompAt));
  const stomp = f >= stompAt;
  const p = punch(f, stompAt, 1.28, 8);
  const [sx, sy] = shake(f, stompAt, 14, 22);
  const top = (h - wh) / 2 - h * 0.04;
  const plus = (dots ?? []).filter((d) => d.plus);
  const sources = plus.length ? plus.filter((_, i) => i % 3 === 0).map((d) => ({ x: d.hx, y: top + d.hy })) : [{ x: w * 0.85, y: h / 2 }];
  const ring = clamp01((f - stompAt) / 18);
  return (
    <AbsoluteFill style={{ background: C.obsidian0, transform: `translate(${sx}px, ${sy}px)` }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(237,232,221,0.075) 1px, transparent 1.6px)", backgroundSize: "24px 24px" }} />
      {dots && <div style={{ position: "absolute", left: 0, top, width: w, height: wh, transform: `scale(${stomp ? p.scale : 1})`, filter: stomp ? `blur(${p.blur}px)` : undefined }}>
        <WordmarkDots dots={dots} p={stomp ? 1 : conv} pitch={pitch} plusFlame={stomp ? 1 : 0} w={w} h={wh} />
      </div>}
      {stomp && ring < 1 && <div style={{ position: "absolute", left: w / 2 - ring * w * 0.9, top: h / 2 - ring * w * 0.9, width: ring * w * 1.8, height: ring * w * 1.8, borderRadius: "50%", boxShadow: `0 0 0 ${6 * (1 - ring)}px rgba(255,181,71,${0.8 * (1 - ring)})` }} />}
      {stomp && <Fire w={w} h={h} sources={sources} height={h * 0.36} spread={h * 0.042} intensity={clamp01((f - stompAt) / 8)} seed={5} />}
      <AbsoluteFill style={{ background: "#fff", opacity: flash(f, stompAt, 4, 0.85) }} />
    </AbsoluteFill>
  );
};

/* ---------- S5 solution: bars 11-18 ---------- */
const Solution: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();                                // local 0 = bar 11
  const lw = w * 0.9, pw = w * 0.34;
  const tilt = (a: number) => `perspective(1800px) rotateY(${a}deg) rotateX(4deg)`;
  const slide = (at: number, d = 10) => ease((f - at) / d);
  // 0-120: laptop deposit + phone sheet; 120-240: reveal; 240-300 candle; 300-420: cleared + payout
  const [sx, sy] = [0, 120, 240, 300].reduce<[number, number]>((a, at) => { const s = shake(f, at, 8, 12); return [a[0] + s[0], a[1] + s[1]]; }, [0, 0]);
  const pay = ease((f - 20) / 40) * 6.2;
  const push = 1 + f * 0.0006;
  return (
    <AbsoluteFill style={{ background: C.obsidian0, transform: `translate(${sx}px, ${sy}px)` }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(237,232,221,0.07) 1px, transparent 1.6px)", backgroundSize: "24px 24px" }} />
      {f < 120 && (
        <AbsoluteFill style={{ transform: `scale(${push})` }}>
          <div style={{ position: "absolute", left: w * 0.05 + (1 - slide(0)) * w, top: h * 0.1, transform: tilt(-9), filter: `blur(${(1 - slide(0)) * 12}px)` }}><Laptop src="ui/l-deposit.png" w={lw} /></div>
          <div style={{ position: "absolute", right: w * 0.04, top: h * 0.42 + (1 - slide(15)) * h * 0.6, transform: tilt(-9) }}><Phone src="ui/p-sheet.png" w={pw} /></div>
          <div style={{ position: "absolute", left: w * 0.06, bottom: h * 0.16, opacity: clamp01((f - 20) / 4), transform: `scale(${punch(f, 20, 1.4, 6).scale})`, transformOrigin: "0 100%" }}>
            <div style={{ fontFamily: sans, fontSize: h * 0.022, color: C.boneDim }}>You get paid now</div>
            <div style={{ fontFamily: mono, fontWeight: 500, fontSize: h * 0.085, color: C.amber, letterSpacing: "-0.04em" }}>${pay.toFixed(2)}</div>
          </div>
        </AbsoluteFill>
      )}
      {f >= 120 && f < 240 && (
        <AbsoluteFill style={{ transform: `scale(${1 + (f - 120) * 0.0009})` }}>
          <div style={{ position: "absolute", left: w * 0.05, top: h * 0.14, transform: tilt(7), filter: `blur(${(1 - slide(120, 8)) * 14}px)`, opacity: slide(120, 8) }}><Laptop src="ui/l-reveal.png" w={lw} /></div>
          <div style={{ position: "absolute", left: w * 0.08, top: h * 0.52 + (1 - slide(135)) * h * 0.5, transform: tilt(7) }}><Phone src="ui/p-deposit.png" w={pw} /></div>
        </AbsoluteFill>
      )}
      {f >= 240 && f < 315 && <AbsoluteFill><Fire w={w} h={h} sources={[{ x: w / 2, y: h * 0.62 }]} height={h * 0.42} spread={h * 0.06} intensity={f < 300 ? 1 : Math.max(0, 1 - (f - 300) / 4)} seed={3} /></AbsoluteFill>}
      {f >= 315 && (
        <AbsoluteFill style={{ transform: `scale(${1 + (f - 315) * 0.0007})` }}>
          <div style={{ position: "absolute", left: w * 0.05, top: h * 0.1, transform: tilt(-8), filter: `blur(${(1 - slide(315, 8)) * 14}px)` }}><Laptop src="ui/l-cleared.png" w={lw} /></div>
          <div style={{ position: "absolute", right: w * 0.04, top: h * 0.46 + (1 - slide(345)) * h * 0.5, transform: tilt(-8) }}><Phone src="ui/p-portfolio.png" w={pw} /></div>
          <div style={{ position: "absolute", left: w * 0.06, bottom: h * 0.16, transform: `scale(${punch(f, 345, 1.5, 6).scale})`, transformOrigin: "0 100%", opacity: f >= 345 ? 1 : 0 }}>
            <div style={{ fontFamily: sans, fontSize: h * 0.022, color: C.boneDim }}>Paid to you</div>
            <div style={{ fontFamily: mono, fontWeight: 500, fontSize: h * 0.085, color: C.amber, letterSpacing: "-0.04em" }}>$6.20</div>
          </div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: "#fff", opacity: Math.max(flash(f, 120, 3, 0.3), flash(f, 315, 3, 0.4), flash(f, 345, 3, 0.2)) }} />
    </AbsoluteFill>
  );
};

/* ---------- S7 conclusion montage: bars 23-25 ---------- */
const Montage: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();
  const shots = [["ui/l-pools.png", "l"], ["ui/p-pools.png", "p"], ["ui/l-settled.png", "l"], ["ui/p-cleared.png", "p"], ["ui/l-portfolio.png", "l"], ["ui/p-portfolio.png", "p"], ["ui/l-cleared.png", "l"], ["ui/p-deposit.png", "p"]];
  const idx = Math.min(shots.length - 1, Math.floor(f / 15));
  const [src, kind] = shots[idx];
  const k = f % 15;
  const words = ["Matching.", "Custody.", "Settlement.", "All onchain.", "On Solana."];
  const wi = Math.min(4, Math.floor(f / 30) - 0), wk = punch(f, Math.floor(f / 30) * 30, 1.5, 6);
  const [sx, sy] = shake(f, Math.floor(f / 15) * 15, 6, 10);
  return (
    <AbsoluteFill style={{ background: C.obsidian0, transform: `translate(${sx}px,${sy}px)` }}>
      <div style={{ position: "absolute", left: w * 0.05, top: kind === "l" ? h * 0.16 : h * 0.07, transform: `scale(${1 + k * 0.004})`, filter: `blur(${Math.max(0, 8 - k * 4)}px)` }}>
        {kind === "l" ? <Laptop src={src} w={w * 0.9} /> : <div style={{ marginLeft: w * 0.24 }}><Phone src={src} w={w * 0.42} /></div>}
      </div>
      <div style={{ position: "absolute", left: w * 0.06, bottom: h * 0.1, transform: `scale(${wk.scale})`, transformOrigin: "0 100%", filter: `blur(${wk.blur}px)`, fontFamily: sans, fontWeight: 900, fontStretch: "125%", fontSize: h * 0.075, letterSpacing: "-0.04em", color: wi >= 3 ? C.amber : C.bone, textShadow: "0 6px 30px rgba(0,0,0,0.9)" }}>{words[wi]}</div>
    </AbsoluteFill>
  );
};

/* ---------- S8 end card ---------- */
const EndCard: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();                                // local 0 = bar 28
  const tag = punch(f, 0, 1.3, 7), soon = punch(f, 60, 1.6, 8);
  const [sx, sy] = shake(f, 60, 12, 20);
  return (
    <AbsoluteFill style={{ background: C.obsidian0, transform: `translate(${sx}px,${sy}px)` }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(237,232,221,0.075) 1px, transparent 1.6px)", backgroundSize: "24px 24px" }} />
      <div style={{ position: "absolute", left: w * 0.06, right: w * 0.06, top: h * 0.2, transform: `scale(${tag.scale})`, filter: `blur(${tag.blur}px)`, transformOrigin: "0 100%", fontFamily: sans, fontWeight: 600, fontSize: h * 0.04, color: C.bone, lineHeight: 1.2 }}>Name your price.<br />Get paid while you wait.</div>
      {f >= 60 && <>
        <div style={{ position: "absolute", left: w * 0.06, top: h * 0.4, transform: `scale(${soon.scale})`, filter: `blur(${soon.blur}px)`, transformOrigin: "0 100%", fontFamily: sans, fontWeight: 900, fontStretch: "125%", fontSize: w * 0.2, letterSpacing: "-0.04em", lineHeight: 0.9, color: C.bone }}>Coming<br /><span style={{ color: C.flame }}>soon.</span></div>
        <Fire w={w} h={h} sources={Array.from({ length: 10 }, (_, i) => ({ x: w * 0.06 + w * 0.2 + i * 14, y: h * 0.4 + w * 0.2 * 2 * 0.9 }))} height={h * 0.12} spread={h * 0.018} intensity={clamp01((f - 60) / 10)} seed={7} />
      </>}
      <div style={{ position: "absolute", left: w * 0.06, right: w * 0.06, bottom: h * 0.05, fontFamily: sans, fontSize: h * 0.0135, lineHeight: 1.5, color: C.boneDim, opacity: clamp01((f - 90) / 12) }}>
        Example numbers shown. Company names and logos are trademarks of their owners. Not affiliated with or endorsed by them.
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: flash(f, 60, 4, 0.7) }} />
    </AbsoluteFill>
  );
};

/* ---------- captions ---------- */
const CAPS = [
  [0, 6, "Hi, I'm Divyanshh, and I help stock traders get paid while they wait for their price."], [6, 9.8, "By letting market makers bid on their limit orders."],
  [10, 12.4, "You want NVIDIA at $171. It's at $180."], [12.4, 15.8, "So you set a limit order. And wait. Days. Earning nothing."],
  [18.2, 19.8, "Limit+"], [20, 23.6, "You name your price."], [24, 27.6, "Market makers bid in secret."], [28, 31.6, "The auction closes at a random moment."], [32, 35.6, "One price clears. You get paid."],
  [36, 40, "Friday's official close decides."], [40, 43.4, "Stock at your price. Or your money back."], [43.4, 47.6, "Either way, you keep the payment."], [48, 51.6, "All onchain. On Solana."],
] as const;
const Caps: React.FC<{ h: number }> = ({ h }) => {
  const t = useCurrentFrame() / 30;
  return <>{CAPS.map(([a, b, text]) => {
    const o = interpolate(t, [a, a + 0.15, b - 0.15, b], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (o <= 0 || (t > 0 && t < 6 && false)) return null;
    return <div key={a} style={{ position: "absolute", left: 0, right: 0, bottom: h * 0.035, textAlign: "center", opacity: o }}><span style={{ display: "inline-block", maxWidth: "92%", padding: `${h * 0.007}px ${h * 0.018}px`, borderRadius: 999, background: "rgba(7,7,10,0.7)", color: C.bone, fontFamily: sans, fontWeight: 600, fontSize: Math.round(h * 0.022) }}>{text}</span></div>;
  })}</>;
};

export const Intro: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <AbsoluteFill style={{ background: C.obsidian0 }}>
    <Audio src={staticFile("track.wav")} />
    <Sequence from={bar(1)} durationInFrames={BAR * 3}><Hook w={w} h={h} /></Sequence>
    <Sequence from={bar(4)} durationInFrames={BAR * 2}><TileSlam w={w} h={h} /></Sequence>
    <Sequence from={bar(6)} durationInFrames={BAR * 3}><Story w={w} h={h} /></Sequence>
    <Sequence from={bar(9)} durationInFrames={BAR * 2}><Stomp w={w} h={h} stompAt={BAR} /></Sequence>
    <Sequence from={bar(11)} durationInFrames={BAR * 8}><Solution w={w} h={h} /></Sequence>
    <Sequence from={bar(19)} durationInFrames={BAR * 3}><Act4 w={w} h={h} /></Sequence>
    <Sequence from={bar(22)} durationInFrames={BAR}><AbsoluteFill style={{ background: C.obsidian0 }}><HeroTile w={w} h={h} t={0} amberLabel /></AbsoluteFill></Sequence>
    <Sequence from={bar(23)} durationInFrames={BAR * 3}><Montage w={w} h={h} /></Sequence>
    <Sequence from={bar(26)} durationInFrames={BAR * 2}><Stomp w={w} h={h} stompAt={BAR} /></Sequence>
    <Sequence from={bar(28)} durationInFrames={BAR * 3}><EndCard w={w} h={h} /></Sequence>
    <Caps h={h} />
  </AbsoluteFill>
);
