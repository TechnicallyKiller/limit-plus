import { NextResponse } from "next/server";

/**
 * Server-side calls to the worker. WORKER_URL and WORKER_SHARED_SECRET are private to this deployment: the browser only
 * ever talks to our own /api routes, so the secret never leaves the server and the worker can ignore anyone else.
 */
export async function callWorker(req: Request, path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<NextResponse> {
  const base = process.env.WORKER_URL;
  if (!base) return NextResponse.json({ error: "The demo is not set up on this deployment." }, { status: 503 });
  const client = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown").split(",")[0].trim();
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: init.method,
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": client,
        ...(process.env.WORKER_SHARED_SECRET ? { "x-limitplus-key": process.env.WORKER_SHARED_SECRET } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    const j = await res.json().catch(() => ({ error: "The demo service sent an unreadable answer." }));
    // Only pass through a message the worker wrote for people. Never leak anything else from upstream.
    const body = res.ok ? j : { error: typeof j?.error === "string" ? j.error : "The demo service had a problem." };
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    const retry = res.headers.get("retry-after");
    if (retry) headers["Retry-After"] = retry;
    return NextResponse.json(body, { status: res.status, headers });
  } catch {
    return NextResponse.json({ error: "The demo service is not reachable right now. Try again in a minute." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export async function readBody(req: Request): Promise<any> {
  try { const text = await req.text(); return text.length > 2048 ? null : text ? JSON.parse(text) : {}; } catch { return null; }
}
