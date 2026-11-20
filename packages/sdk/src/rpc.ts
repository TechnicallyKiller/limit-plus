import type { Commitment, Connection } from "@solana/web3.js";

/**
 * Public Solana RPC endpoints rate limit hard (devnet answers 429 "Connection rate limits exceeded"). web3.js then throws
 * that error from a background callback, which is an uncaught exception that kills a long-running process. This is a
 * fetch for Connection that paces requests and retries 429s and 5xx with backoff, so a busy endpoint slows us down instead
 * of crashing us. Pass it as `new Connection(url, { fetch: rpcFetch(), disableRetryOnRateLimit: true })`.
 */
export interface RpcFetchOptions {
  /** Minimum gap between request starts, in ms. 0 turns pacing off (a local validator needs none). */
  minGapMs?: number;
  maxRetries?: number;
  baseMs?: number;
  maxDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  onRetry?: (message: string) => void;
}

export function rpcFetch(o: RpcFetchOptions = {}): typeof fetch {
  const f = o.fetchImpl ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  const random = o.random ?? Math.random;
  const gap = o.minGapMs ?? 0, retries = o.maxRetries ?? 8, base = o.baseMs ?? 400, cap = o.maxDelayMs ?? 8000;
  let nextSlot = 0;
  // Reserve the next start time, so concurrent callers queue up behind each other instead of bursting together.
  const pace = async () => {
    if (gap <= 0) return;
    const t = now(), at = Math.max(t, nextSlot);
    nextSlot = at + gap;
    if (at > t) await sleep(at - t);
  };
  const backoff = (i: number) => Math.min(base * 2 ** i, cap) * (0.75 + random() * 0.5);

  return (async (input: any, init?: any) => {
    let lastRes: Response | undefined, lastErr: unknown;
    for (let i = 0; i <= retries; i++) {
      await pace();
      let delay: number;
      try {
        const res = await f(input, init);
        if (res.status !== 429 && res.status < 500) return res;
        lastRes = res; lastErr = undefined;
        const ra = Number(res.headers?.get?.("retry-after"));
        delay = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, cap) : backoff(i);
      } catch (e: any) {
        if (e?.name === "AbortError") throw e; // the caller gave up on purpose
        lastErr = e; lastRes = undefined;
        delay = backoff(i);
      }
      if (i === retries) break;
      o.onRetry?.(`RPC ${lastRes ? lastRes.status : "network error"}, retrying in ${Math.round(delay)}ms`);
      await sleep(delay);
    }
    if (lastRes) return lastRes;
    throw lastErr;
  }) as typeof fetch;
}

export interface ConfirmOptions { timeoutMs?: number; everyMs?: number; commitment?: Commitment; sleep?: (ms: number) => Promise<void>; now?: () => number }

/**
 * Waits for a signature over plain HTTP polling. web3.js's own confirmTransaction opens a websocket, and public endpoints
 * rate limit those too. Throws if the transaction failed on chain or was not seen in time.
 */
export async function confirmByPolling(c: Connection, signature: string, o: ConfirmOptions = {}): Promise<void> {
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  const want = o.commitment ?? "confirmed";
  const deadline = now() + (o.timeoutMs ?? 60_000);
  for (;;) {
    let st: Awaited<ReturnType<Connection["getSignatureStatuses"]>>["value"][number] = null;
    try { st = (await c.getSignatureStatuses([signature])).value[0]; } catch { /* a busy endpoint: try again until the deadline */ }
    if (st) {
      if (st.err) throw new Error(`transaction ${signature} failed on chain: ${JSON.stringify(st.err)}`);
      const level = st.confirmationStatus;
      if (level === "finalized" || (level === "confirmed" && want !== "finalized") || (level === "processed" && want === "processed")) return;
    }
    if (now() >= deadline) throw new Error(`transaction ${signature} was not confirmed in ${Math.round((o.timeoutMs ?? 60_000) / 1000)}s`);
    await sleep(o.everyMs ?? 1200);
  }
}
