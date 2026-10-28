import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Act3, Act4, HeroTile } from "./Act3";
import { Chart, LOGOS, leaves } from "./Act0";
import { Level2 } from "./Act2";
import { Fire } from "./Fire";
import { BAR, BEAT, EndCard, Laptop, Phone, Stomp, Word, flash, punch, shake } from "./Intro";
import { clamp01, ease, easeIO, rand } from "./parts";
import { C, mono, sans } from "./tokens";
import { staticFile as sf } from "remotion";

/** v4: 58 seconds, 29 bars at 120 BPM. Pitch opening + product proof, one device shot per idea. */
const bar = (n: number, beat = 0) => (n - 1) * BAR + beat * BEAT;

/** Glitch cut: first frames of every scene get an RGB split and a jitter. */
const Cut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const g = f < 4 ? (4 - f) / 4 : 0;
  return <AbsoluteFill style={{ filter: g > 0 ? `drop-shadow(${10 * g}px 0 0 rgba(255,40,80,0.55)) drop-shadow(${-10 * g}px 0 0 rgba(40,220,255,0.5))` : undefined, transform: g > 0 ? `translate(${(rand(f * 3.1) - 0.5) * 24 * g}px, ${(rand(f * 7.7) - 0.5) * 12 * g}px)` : undefined }}>{children}</AbsoluteFill>;
};

const CoinBurst: React.FC<{ at: number; x: number; y: number; f: number }> = ({ at, x, y, f }) => {
  const k = f - at; if (k < 0 || k > 45) return null;
  return <>{Array.from({ length: 44 }, (_, i) => {
    const a = (i / 44) * Math.PI * 2 + rand(i) * 0.5, sp = 10 + rand(i * 3.3) * 22, t = k / 30;
    const px = x + Math.cos(a) * sp * k * 0.9, py = y + Math.sin(a) * sp * k * 0.9 + 140 * t * t;
    return <div key={i} style={{ position: "absolute", left: px, top: py, width: 9 + rand(i * 5) * 8, height: 9 + rand(i * 5) * 8, borderRadius: 99, background: i % 3 ? C.amber : "#FFE9B8", opacity: 1 - k / 45 }} />;
  })}</>;
};

/* bars 1-5: the original pull-back, faster, slamming on the kicks, then the drain */
const PullBack: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();
  const W = 1300, H = 1650;
  const a0 = leaves.find((l) => l.name === "NVDAx")!;
  const ax = a0.x + a0.w / 2, ay = a0.y + a0.h / 2;
  const startS = (Math.min(w, h) * 0.66) / a0.w, endS = Math.max(w / W, h / H) * 1.03;
  const k = easeIO(clamp01((f - 10) / 100));
  const scale = Math.exp(Math.log(startS) * (1 - k) + Math.log(endS) * k);
  const fx = ax * (1 - k) + (W / 2) * k, fy = ay * (1 - k) + (H / 2) * k;
  const maxD = Math.max(...leaves.map((l) => Math.hypot(l.x + l.w / 2 - ax, l.y + l.h / 2 - ay)));
  const [sx, sy] = f < 115 ? shake(f, Math.floor(f / 15) * 15, 5, 8) : [0, 0];
  const pulse = f > 110 && f < 250 ? Math.max(0, 1 - (f % 15) / 6) * 0.1 : 0;
  const drain = clamp01((f - 255) / 35);
  const colour = clamp01((f - 14) / 16);
  return (
    <AbsoluteFill style={{ background: C.obsidian0, transform: `translate(${sx}px,${sy}px)` }}>
      <AbsoluteFill style={{ filter: `grayscale(${drain}) brightness(${1 + pulse})` }}>
        <div style={{ position: "absolute", left: w / 2 - fx * scale, top: h / 2 - fy * scale, width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          {leaves.map((l) => {
            const isA = l.name === "NVDAx";
            const d = Math.hypot(l.x + l.w / 2 - ax, l.y + l.h / 2 - ay) / maxD;
            const at = isA ? 0 : 14 + d * 84;
            const kk = clamp01((f - at) / 5); if (kk <= 0) return null;
            const e = 1 - Math.pow(1 - kk, 3);
            const pig = l.i % 5 === 1 || l.i % 7 === 3 ? C.iris : C.volt;
            const bg = isA ? (colour < 1 ? `rgb(${Math.round(14 + (200 - 14) * colour)}, ${Math.round(14 + (245 - 14) * colour)}, ${Math.round(19 + (60 - 19) * colour)})` : C.volt) : f - at < 2 ? "#fff" : pig;
            const ink = isA && colour < 0.5 ? C.bone : C.obsidian0;
            const logo = (LOGOS as any)[l.name];
            const fs = Math.min(l.w * 0.2, l.h * 0.2, 44), logoH = Math.min(fs * 1.05, l.h * 0.28), logoW = logo ? Math.min(logoH * logo.aspect, l.w * 0.62) : 0;
            return (
              <div key={l.name} style={{ position: "absolute", left: l.x, top: l.y, width: l.w, height: l.h, borderRadius: Math.min(26, l.w * 0.14), background: bg, opacity: e, transform: `scale(${isA ? 1 : 1.35 - 0.35 * e})`, overflow: "hidden", boxShadow: isA && colour < 0.5 ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "inset 0 0 0 1px rgba(0,0,0,0.18)" }}>
                <Chart seed={l.i + 1} t={f / 30 * (isA ? 1 : 1 + rand(l.i) * 2)} w={l.w} h={l.h} stroke={ink} />
                {l.w > 110 && l.h > 80 && <div style={{ position: "absolute", left: l.w * 0.08, top: l.h * 0.08, display: "flex", alignItems: "center", gap: fs * 0.4, color: ink, fontFamily: sans, fontWeight: 600, fontSize: fs }}>
                  {logo && <div style={{ height: logoH, width: logoW, background: ink, WebkitMaskImage: `url(${staticFile(logo.file)})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "left center" }} />}
                  {(!logo || logo.aspect < 1.8) && !isA ? l.name : null}
                </div>}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};


/* bars 6-8, rebuilt to follow the voice: 10.0 your price, 12.45 now, 14.0 the wait, 15.3 nothing. Local t = seconds since 0:10. */
const StoryV2: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame(); const t = f / 30;
  const tw = Math.min(w, h) * 0.66, th = tw * 0.92, left = (w - tw) / 2, top = (h - th) / 2 - h * 0.05;
  const dashY = top + th * 0.58, priceY = top + th * 0.3;
  const speed = 1 + 2.2 * clamp01((t - 4.0) / 1.0);
  const drain = clamp01((t - 5.2) / 0.5);
  const [sx, sy] = [0, 2.45, 4.0, 5.3].reduce<[number, number]>((a, at) => { const k = shake(f, at * 30, 7, 10); return [a[0] + k[0], a[1] + k[1]]; }, [0, 0]);
  const tag = punch(f, 5, 1.5, 6), now = punch(f, 2.45 * 30, 1.5, 6);
  const gap = ease((t - 2.6) / 0.5);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const flat = ease((t - 5.3) / 0.35);
  const nothing = punch(f, 5.4 * 30, 1.8, 7);
  return (
    <AbsoluteFill style={{ background: C.obsidian0, transform: `translate(${sx}px,${sy}px)` }}>
      <AbsoluteFill style={{ filter: `grayscale(${drain})` }}>
        <HeroTile w={w} h={h} t={t * speed} y={-h * 0.05} above />
        {/* your price tag on the dashed line */}
        {t >= 0.15 && <div style={{ position: "absolute", left: left + tw * 0.04, top: dashY + th * 0.03, transform: `scale(${tag.scale})`, transformOrigin: "0 0", padding: `${h * 0.008}px ${h * 0.018}px`, borderRadius: 999, boxShadow: `inset 0 0 0 2px ${C.flame}`, background: C.obsidian1, fontFamily: mono, fontSize: h * 0.024, color: C.flame }}>Your price $171.00</div>}
        {/* now marker and the measured gap */}
        {t >= 2.45 && <>
          <div style={{ position: "absolute", left: left + tw * 0.04, top: priceY - th * 0.06, transform: `scale(${now.scale})`, transformOrigin: "0 100%", padding: `${h * 0.008}px ${h * 0.018}px`, borderRadius: 999, background: C.bone, fontFamily: mono, fontSize: h * 0.024, color: C.obsidian0 }}>Now $180.00</div>
          <div style={{ position: "absolute", left: left + tw * 0.86, top: priceY, width: 3, height: (dashY - priceY) * gap, background: C.amber }} />
          <div style={{ position: "absolute", left: left + tw * 0.86 - h * 0.085, top: priceY + (dashY - priceY) / 2 - h * 0.016, opacity: gap, fontFamily: mono, fontSize: h * 0.026, color: C.amber }}>-5.0%</div>
        </>}
        {/* the week going by */}
        <div style={{ position: "absolute", left, top: top + th + h * 0.045, width: tw, display: "flex", gap: tw * 0.02 }}>
          {days.map((d, i) => {
            const lit = t >= 4.0 + i * 0.25;
            return <div key={d} style={{ flex: 1, textAlign: "center", padding: `${h * 0.012}px 0`, borderRadius: 14, background: lit ? C.bone : C.obsidian2, color: lit ? C.obsidian0 : C.boneFaint, fontFamily: mono, fontSize: h * 0.022, transform: lit && t < 4.0 + i * 0.25 + 0.2 ? "scale(1.12)" : undefined, opacity: t >= 3.6 ? 1 : 0 }}>{d}</div>;
          })}
        </div>
      </AbsoluteFill>
      {/* flatline: the line gives up */}
      {t >= 5.3 && <>
        <div style={{ position: "absolute", left, top, width: tw, height: th, borderRadius: tw * 0.05, background: C.obsidian1, opacity: 0.96 * flat }} />
        <div style={{ position: "absolute", left, top: top + th * 0.5 - 2, width: tw * flat, height: 4, borderRadius: 2, background: C.boneFaint }} />
      </>}
      {t >= 5.4 && <Word text="nothing." at={5.4 * 30} f={f} size={w * 0.175} x={w * 0.1} y={top + th * 0.5 - w * 0.1} color={C.bone} />}
      <AbsoluteFill style={{ background: C.bone, opacity: Math.max(flash(f, 5.3 * 30, 3, 0.18), flash(f, 2.45 * 30, 3, 0.12)) }} />
    </AbsoluteFill>
  );
};

/* bars 11-12: phone solo with kinetic type and the coin burst */
const PhoneSolo: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();
  const pw = w * 0.56;
  const rise = ease((f - 2) / 14);
  const pay = ease((f - 70) / 30) * 6.2;
  const [sx, sy] = [0, 70].reduce<[number, number]>((a, at) => { const s = shake(f, at, 8, 12); return [a[0] + s[0], a[1] + s[1]]; }, [0, 0]);
  return (
    <AbsoluteFill style={{ background: C.obsidian0, transform: `translate(${sx}px,${sy}px)` }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(237,232,221,0.07) 1px, transparent 1.6px)", backgroundSize: "24px 24px" }} />
      <div style={{ position: "absolute", left: w / 2 - pw / 2, top: h * 0.22 + (1 - rise) * h, transform: `perspective(1800px) rotateY(${-12 + f * 0.05}deg) rotateX(4deg) scale(${1 + f * 0.0007})` }}><Phone src="ui/p-sheet.png" w={pw} /></div>
      <Word text="Name your" at={0} f={f} size={w * 0.13} x={w * 0.06} y={h * 0.04} />
      <Word text="price." at={14} f={f} size={w * 0.13} x={w * 0.06} y={h * 0.04 + w * 0.12} color={C.amber} />
      {f >= 70 && <div style={{ position: "absolute", right: w * 0.05, bottom: h * 0.16, textAlign: "right", transform: `scale(${punch(f, 70, 1.5, 6).scale})`, transformOrigin: "100% 100%" }}>
        <div style={{ fontFamily: sans, fontSize: h * 0.022, color: C.boneDim }}>You get paid now</div>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: h * 0.09, color: C.amber, letterSpacing: "-0.04em", textShadow: "0 0 40px rgba(255,181,71,0.5)" }}>${pay.toFixed(2)}</div>
      </div>}
      <CoinBurst at={70} x={w * 0.5} y={h * 0.55} f={f} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash(f, 70, 3, 0.3) }} />
    </AbsoluteFill>
  );
};

/* bar 15: the candle, then silence. The fire dies on the beat. */
const Candle: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();
  const inten = f < 60 ? clamp01(f / 10) : Math.max(0, 1 - (f - 60) / 4);
  const zoom = 1 + f * 0.0025;
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 62%" }}>
        <Fire w={w} h={h} sources={[{ x: w / 2, y: h * 0.62 }]} height={h * 0.5} spread={h * 0.075} intensity={inten} seed={3} />
      </AbsoluteFill>
      {f >= 60 && f < 66 && <AbsoluteFill style={{ background: C.obsidian0, opacity: clamp01((f - 60) / 3) }} />}
    </AbsoluteFill>
  );
};

/* bars 16 end to 17: laptop and phone together, once */
const DevicesOnce: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();
  const s = (at: number, d = 10) => ease((f - at) / d);
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(237,232,221,0.07) 1px, transparent 1.6px)", backgroundSize: "24px 24px" }} />
      <div style={{ position: "absolute", left: w * 0.05, top: h * 0.1, transform: `perspective(1800px) rotateY(-8deg) rotateX(4deg) scale(${1 + f * 0.0008})`, filter: `blur(${(1 - s(0)) * 12}px)`, opacity: s(0) }}><Laptop src="ui/l-cleared.png" w={w * 0.9} /></div>
      <div style={{ position: "absolute", right: w * 0.04, top: h * 0.44 + (1 - s(10)) * h * 0.5, transform: "perspective(1800px) rotateY(-8deg) rotateX(4deg)" }}><Phone src="ui/p-portfolio.png" w={w * 0.34} /></div>
      {f >= 24 && <div style={{ position: "absolute", left: w * 0.06, bottom: h * 0.15, transform: `scale(${punch(f, 24, 1.5, 6).scale})`, transformOrigin: "0 100%" }}>
        <div style={{ fontFamily: sans, fontSize: h * 0.022, color: C.boneDim }}>Paid to you</div>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: h * 0.09, color: C.amber, letterSpacing: "-0.04em", textShadow: "0 0 40px rgba(255,181,71,0.5)" }}>$6.20</div>
      </div>}
      <CoinBurst at={24} x={w * 0.75} y={h * 0.62} f={f} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash(f, 24, 3, 0.3) }} />
    </AbsoluteFill>
  );
};

/* bars 23-24: the token field comes back with the three words */
const FieldCallback: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();
  const W = 1300, H = 1650, sc = Math.max(w / W, h / H) * 1.03;
  const pulse = Math.max(0, 1 - (f % 15) / 6) * 0.14;
  const words = [["Matching.", 0], ["Custody.", 30], ["Settlement.", 60], ["All onchain. On Solana.", 90]] as [string, number][];
  const cur = [...words].reverse().find(([, at]) => f >= at);
  const [sx, sy] = shake(f, Math.floor(f / 15) * 15, 5, 8);
  return (
    <AbsoluteFill style={{ background: C.obsidian0, transform: `translate(${sx}px,${sy}px)` }}>
      <AbsoluteFill style={{ filter: `brightness(${1 + pulse})` }}>
        <div style={{ position: "absolute", left: w / 2 - (W / 2) * sc, top: h / 2 - (H / 2) * sc, width: W, height: H, transform: `scale(${sc})`, transformOrigin: "0 0" }}>
          {leaves.map((l) => {
            const pig = l.i % 5 === 1 || l.i % 7 === 3 ? C.iris : C.volt;
            return <div key={l.name} style={{ position: "absolute", left: l.x, top: l.y, width: l.w, height: l.h, borderRadius: Math.min(26, l.w * 0.14), background: pig, overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)" }}><Chart seed={l.i + 1} t={f / 30 * (1 + rand(l.i) * 2)} w={l.w} h={l.h} stroke={C.obsidian0} /></div>;
          })}
        </div>
      </AbsoluteFill>
      {cur && <div style={{ position: "absolute", left: 0, right: 0, top: h * 0.42, textAlign: "center", transform: `scale(${punch(f, cur[1], 1.5, 6).scale})` }}>
        <span style={{ display: "inline-block", padding: `${h * 0.012}px ${h * 0.03}px`, background: C.obsidian0, color: C.bone, fontFamily: sans, fontWeight: 900, fontStretch: "125%", fontSize: cur[1] === 90 ? h * 0.05 : h * 0.07, letterSpacing: "-0.03em", borderRadius: 16 }}>{cur[0]}</span>
      </div>}
    </AbsoluteFill>
  );
};

const RoomWrap: React.FC<{ w: number; h: number }> = ({ w, h }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ background: C.obsidian0 }}><Level2 w={w} h={h} t={f / 30 + 0.2} /></AbsoluteFill>; };

const CAPS = [
  [0.2, 6.2, "Hi, I'm Divyanshh, and I help stock traders get paid while they wait for their price."], [6.2, 9.9, "By letting market makers bid on their limit orders."],
  [10.0, 12.4, "You want NVIDIA at $171."], [12.45, 13.9, "It's at $180."], [14.0, 16.3, "So you wait. For nothing."], [18.0, 19.7, "Limit+"],
  [20.2, 22.3, "You name your price. You get paid."], [24.2, 26.9, "Market makers bid in secret."], [27.7, 30.0, "The auction ends at a random moment."], [31.0, 33.7, "One price clears. You get paid."],
  [36.2, 38.5, "Friday's official close decides."], [39.6, 42.0, "Stock at your price. Or your money back."], [42.2, 44.5, "Either way, you keep the payment."], [44.7, 48.0, "All onchain. On Solana."],
] as const;
const Caps: React.FC<{ h: number }> = ({ h }) => {
  const t = useCurrentFrame() / 30;
  return <>{CAPS.map(([a, b, text]) => {
    const o = interpolate(t, [a, a + 0.15, b - 0.15, b], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (o <= 0) return null;
    return <div key={a} style={{ position: "absolute", left: 0, right: 0, bottom: h * 0.035, textAlign: "center", opacity: o }}><span style={{ display: "inline-block", maxWidth: "92%", padding: `${h * 0.007}px ${h * 0.018}px`, borderRadius: 999, background: "rgba(7,7,10,0.72)", color: C.bone, fontFamily: sans, fontWeight: 600, fontSize: Math.round(h * 0.022) }}>{text}</span></div>;
  })}</>;
};

export const Intro2: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <AbsoluteFill style={{ background: C.obsidian0 }}>
    <Audio src={staticFile("mix.wav")} />
    <Sequence from={bar(1)} durationInFrames={BAR * 5}><Cut><PullBack w={w} h={h} /></Cut></Sequence>
    <Sequence from={bar(6)} durationInFrames={BAR * 3}><Cut><StoryV2 w={w} h={h} /></Cut></Sequence>
    <Sequence from={bar(9)} durationInFrames={BAR * 2}><Stomp w={w} h={h} stompAt={BAR} /></Sequence>
    <Sequence from={bar(11)} durationInFrames={BAR * 2}><Cut><PhoneSolo w={w} h={h} /></Cut></Sequence>
    <Sequence from={bar(13)} durationInFrames={BAR * 2}><Cut><RoomWrap w={w} h={h} /></Cut></Sequence>
    <Sequence from={bar(15)} durationInFrames={BAR + BEAT}><Candle w={w} h={h} /></Sequence>
    <Sequence from={bar(16, 1)} durationInFrames={85}><Act3 w={w} h={h} /></Sequence>
    <Sequence from={bar(16, 1) + 85} durationInFrames={BAR * 3 - BEAT - 85}><Cut><DevicesOnce w={w} h={h} /></Cut></Sequence>
    <Sequence from={bar(19)} durationInFrames={BAR * 4}><Cut><Act4 w={w} h={h} /></Cut></Sequence>
    <Sequence from={bar(23)} durationInFrames={BAR * 2}><Cut><FieldCallback w={w} h={h} /></Cut></Sequence>
    <Sequence from={bar(25) - 4} durationInFrames={BAR * 2 + 4}><Stomp w={w} h={h} stompAt={BAR} /></Sequence>
    <Sequence from={bar(27)} durationInFrames={BAR * 3}><EndCard w={w} h={h} /></Sequence>
    <Caps h={h} />
  </AbsoluteFill>
);
void sf; void HeroTile; void easeIO;
