"use client";
import { useEffect, useRef } from "react";

interface Dot { hx: number; hy: number; x: number; y: number; vx: number; vy: number }

/** "limit+" as bone dots on a grid. Dots fly in once, get pushed by the pointer, spring back, and the loop sleeps when everything is at rest. */
export default function HalftoneWordmark() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = wrap.current!, cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dots: Dot[] = [], raf = 0, running = false, visible = true, entrance = 0, start = 0;
    const pointer = { x: -999, y: -999, active: false };
    let dpr = 1, W = 0, H = 0, pitch = 7;

    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const bone = css("--color-bone") || "#EDE8DD", flame = css("--color-flame") || "#FF5B22";
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [br, bg, bb] = rgb(bone.length === 7 ? bone : "#EDE8DD"), [fr, fg, fb] = rgb(flame.length === 7 ? flame : "#FF5B22");

    const build = () => {
      const r = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height; pitch = W < 640 ? 10 : 7;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      const off = document.createElement("canvas"); off.width = W; off.height = H;
      const o = off.getContext("2d")!;
      const family = getComputedStyle(document.body).fontFamily.split(",")[0];
      let size = H * 1.1;
      o.textBaseline = "alphabetic"; o.fillStyle = "#fff";
      (o as any).fontStretch = "extra-expanded";
      for (let i = 0; i < 8; i++) { o.font = `900 ${size}px ${family}`; if (o.measureText("limit+").width <= W * 0.99) break; size *= 0.9; }
      const m = o.measureText("limit+");
      o.fillText("limit+", (W - m.width) / 2, H * 0.5 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
      const data = o.getImageData(0, 0, W, H).data;
      dots = [];
      for (let y = pitch / 2; y < H; y += pitch) for (let x = pitch / 2; x < W; x += pitch) {
        if (data[(Math.floor(y) * Math.floor(W) + Math.floor(x)) * 4 + 3] > 128) {
          dots.push({ hx: x, hy: y, x: reduced ? x : Math.random() * W, y: reduced ? y : Math.random() * H, vx: 0, vy: 0 });
        }
      }
      entrance = reduced ? 1 : 0; start = performance.now();
      draw(); if (!reduced) wake();
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        const dist = Math.hypot(d.x - pointer.x, d.y - pointer.y), t = Math.max(0, 1 - dist / 90);
        ctx.fillStyle = `rgb(${br + (fr - br) * t | 0} ${bg + (fg - bg) * t | 0} ${bb + (fb - bb) * t | 0})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, 2.2 * (pitch / 7), 0, 6.2832); ctx.fill();
      }
    };

    const step = (now: number) => {
      raf = 0; if (!visible) { running = false; return; }
      const e = Math.min(1, (now - start) / 900), ease = 1 - Math.pow(1 - e, 4);
      let moving = e < 1;
      for (const d of dots) {
        if (e < 1) { d.x += (d.hx - d.x) * (0.05 + 0.2 * ease); d.y += (d.hy - d.y) * (0.05 + 0.2 * ease); }
        else {
          let fx = (d.hx - d.x) * 0.12, fy = (d.hy - d.y) * 0.12;
          if (pointer.active) { const dx = d.x - pointer.x, dy = d.y - pointer.y, dist = Math.hypot(dx, dy); if (dist < 90 && dist > 0.01) { const k = (1 - dist / 90) * 6; fx += (dx / dist) * k; fy += (dy / dist) * k; } }
          d.vx = (d.vx + fx) * 0.78; d.vy = (d.vy + fy) * 0.78; d.x += d.vx; d.y += d.vy;
          if (Math.abs(d.vx) + Math.abs(d.vy) > 0.02 || Math.abs(d.hx - d.x) + Math.abs(d.hy - d.y) > 0.3) moving = true;
        }
      }
      draw();
      if (moving || pointer.active) raf = requestAnimationFrame(step); else running = false;
    };
    const wake = () => { if (!running && visible && !reduced) { running = true; raf = requestAnimationFrame(step); } };

    const move = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true; wake(); };
    const leave = () => { pointer.active = false; pointer.x = pointer.y = -999; wake(); };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); }, { threshold: 0 });
    const vis = () => { visible = !document.hidden; if (visible) wake(); };
    const ro = new ResizeObserver(() => build());
    io.observe(host); ro.observe(host); document.addEventListener("visibilitychange", vis);
    if (!reduced) { cv.addEventListener("pointermove", move); cv.addEventListener("pointerleave", leave); }
    document.fonts.ready.then(build);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", vis); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerleave", leave); };
  }, []);

  return (
    <div ref={wrap} className="relative w-full touch-pan-y" style={{ height: "clamp(150px, 27vw, 440px)", contentVisibility: "auto", containIntrinsicSize: "auto 340px" }}>
      <h1 className="sr-only">Limit+</h1>
      <canvas ref={canvas} aria-hidden="true" className="absolute inset-0" />
    </div>
  );
}
