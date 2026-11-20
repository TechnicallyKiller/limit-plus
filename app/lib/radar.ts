"use client";
import { useEffect, useState } from "react";
import type { RadarSnapshot } from "@limit-plus/radar/src/types";

export type RadarState = "loading" | "ready" | "error";

/** The radar for one stock, refreshed every five minutes. Keeps the last good answer if a refresh fails. */
export function useRadar(ticker: string): { snap?: RadarSnapshot; state: RadarState } {
  const [snap, setSnap] = useState<RadarSnapshot | undefined>();
  const [state, setState] = useState<RadarState>("loading");
  useEffect(() => {
    const ctl = new AbortController();
    let live = true;
    setSnap(undefined); setState("loading");
    const load = async () => {
      try {
        const res = await fetch(`/api/radar?ticker=${encodeURIComponent(ticker)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as RadarSnapshot;
        if (live) { setSnap(j); setState("ready"); }
      } catch { if (live) setState((s) => (s === "ready" ? "ready" : "error")); }
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { live = false; ctl.abort(); clearInterval(id); };
  }, [ticker]);
  return { snap, state };
}

/** "12 minutes ago", "3 hours ago", "2 days ago". */
export function ago(iso: string, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
  if (s < 90) return "just now";
  const m = Math.round(s / 60);
  if (m < 90) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hours ago`;
  return `${Math.round(h / 24)} days ago`;
}
