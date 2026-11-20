"use client";
import { useEffect, useState } from "react";

/** The demo (a built-in test wallet, a faucet and a one-click demo week) is for devnet deployments only. */
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export type DemoOutcome = "buy" | "skip";
export interface DemoState {
  status: "idle" | "running" | "finished" | "failed";
  roundKey?: string;
  outcome?: DemoOutcome;
  spot?: number;
  yourPrice?: number;
  closePrice?: number;
  startedAt?: number;
  bidStartTs?: number;
  phase?: string;
  expiryTs?: number;
  error?: string;
  feed: string[];
}

export class DemoError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try { res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new DemoError("Could not reach the demo service. Check your connection and try again.", 0); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new DemoError(typeof j?.error === "string" ? j.error : "The demo service had a problem. Try again in a moment.", res.status);
  return j as T;
}

export const startDemoWeek = (outcome: DemoOutcome, depositSecs = 60) => post<DemoState>("/api/demo/start", { outcome, depositSecs });
export const requestTestFunds = (wallet: string) => post<{ usdc: number; sol: number }>("/api/faucet", { wallet });

/** The live demo state, polled every two seconds. `unavailable` is true when the service cannot be reached. */
export function useDemoState(): { state?: DemoState; unavailable: boolean } {
  const [state, setState] = useState<DemoState | undefined>();
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!DEMO) return;
    let live = true;
    const ctl = new AbortController();
    const tick = async () => {
      try {
        const res = await fetch("/api/demo", { signal: ctl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as DemoState;
        if (live) { setState(j); setUnavailable(false); }
      } catch { if (live) setUnavailable(true); }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { live = false; ctl.abort(); clearInterval(id); };
  }, []);
  return { state, unavailable };
}
