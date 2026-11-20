import * as http from "http";
import { normalizeTicker, type RadarService } from "../packages/radar/src";
import { Director, DirectorError } from "./director";

export interface ServerOpts {
  radar: RadarService;
  /** Absent when the demo is turned off: the demo and faucet routes then answer 503. */
  director?: Director;
  cluster: string;
  /** When set, POST routes need this value in the x-limitplus-key header, so only our own web tier can start demos. */
  sharedSecret?: string;
  /** Reports the admin wallet balance in SOL, for the status route. */
  adminSol?: () => Promise<number>;
  now?: () => number;
  log?: (m: string) => void;
}

/** Sliding-window counter per key. */
class Limiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number, private now: () => number) {}
  /** Returns 0 when allowed, otherwise the seconds to wait. */
  take(key: string): number {
    const t = this.now();
    const arr = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (arr.length >= this.max) { this.hits.set(key, arr); return Math.ceil((this.windowMs - (t - arr[0])) / 1000); }
    arr.push(t);
    this.hits.set(key, arr);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((x) => t - x < this.windowMs)) this.hits.delete(k);
    return 0;
  }
}

const MAX_BODY = 2048;

export function createServer(o: ServerOpts): http.Server {
  const now = o.now ?? Date.now;
  const started = now();
  const reads = new Limiter(120, 60_000, now);
  const writes = new Limiter(10, 60_000, now);
  const faucetIp = new Limiter(15, 3_600_000, now); // a venue is often one address for every visitor; the global cap below still bounds spending
  const faucetGlobal = new Limiter(80, 3_600_000, now);
  const faucetWallet = new Limiter(1, 10 * 60_000, now);

  const send = (res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    const text = JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(text), "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers });
    res.end(text);
  };
  const readJson = (req: http.IncomingMessage) => new Promise<any>((resolve, reject) => {
    let size = 0; const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => { size += c.length; if (size > MAX_BODY) { reject(new DirectorError("bad_request", "body too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new DirectorError("bad_request", "body is not valid JSON")); } });
    req.on("error", reject);
  });
  // The web tier tells us the visitor's address in x-limitplus-client-ip. It is only believed when the shared secret matches,
  // because a proxy in between may rewrite x-forwarded-for.
  const ipOf = (req: http.IncomingMessage) => {
    const trusted = o.sharedSecret && req.headers["x-limitplus-key"] === o.sharedSecret && req.headers["x-limitplus-client-ip"];
    return String(trusted ?? req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();
  };

  let rpcCache: { at: number; ok: boolean; sol?: number } | undefined;

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://worker");
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const method = req.method ?? "GET";
      const ip = ipOf(req);

      const wait = (method === "GET" ? reads : writes).take(ip);
      if (wait) return send(res, 429, { error: "slow down" }, { "retry-after": String(wait) });

      if (method === "GET" && path === "/health") return send(res, 200, { ok: true, uptimeSecs: Math.round((now() - started) / 1000), cluster: o.cluster });

      if (method === "GET" && path === "/status") {
        if (!rpcCache || now() - rpcCache.at > 15_000) {
          try { rpcCache = { at: now(), ok: true, sol: o.adminSol ? await o.adminSol() : undefined }; } catch { rpcCache = { at: now(), ok: false }; }
        }
        const demo = o.director ? await o.director.status() : undefined;
        return send(res, 200, {
          ok: rpcCache.ok, cluster: o.cluster, uptimeSecs: Math.round((now() - started) / 1000), adminSol: rpcCache.sol,
          lowOnSol: rpcCache.sol !== undefined && rpcCache.sol < 0.5,
          radar: { count: o.radar.all().length, lastRunAt: o.radar.lastRunAt ?? null, lastError: o.radar.lastError ?? null },
          demo: demo ? { status: demo.status, phase: demo.phase ?? null, roundKey: demo.roundKey ?? null } : null,
        });
      }

      if (method === "GET" && path === "/radar") return send(res, 200, o.radar.all(), { "cache-control": "public, max-age=30" });
      const m = path.match(/^\/radar\/([A-Za-z]{1,8})$/);
      if (method === "GET" && m) {
        const t = normalizeTicker(m[1]);
        if (!t) return send(res, 404, { error: "unknown ticker" });
        const snap = o.radar.get(t);
        return snap ? send(res, 200, snap, { "cache-control": "public, max-age=30" }) : send(res, 404, { error: "no radar data yet" });
      }

      if (method === "GET" && path === "/demo") {
        if (!o.director) return send(res, 503, { error: "the demo is turned off" });
        return send(res, 200, await o.director.status());
      }

      if (method === "POST" && (path === "/demo/start" || path === "/faucet")) {
        if (o.sharedSecret && req.headers["x-limitplus-key"] !== o.sharedSecret) return send(res, 401, { error: "not allowed" });
        if (!o.director) return send(res, 503, { error: "the demo is turned off" });
        const body = await readJson(req);
        if (path === "/demo/start") {
          const state = await o.director.start(body.outcome ?? "buy", { depositSecs: body.depositSecs });
          return send(res, 202, state);
        }
        const wallet = String(body.wallet ?? "");
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) return send(res, 400, { error: "That is not a valid wallet address." });
        const w = faucetWallet.take(wallet);
        if (w) return send(res, 429, { error: "This wallet already got test funds. Try again in a few minutes." }, { "retry-after": String(w) });
        const i = faucetIp.take(ip), g = faucetGlobal.take("all");
        if (i || g) return send(res, 429, { error: "The faucet is busy. Try again in a few minutes." }, { "retry-after": String(i || g) });
        return send(res, 200, await o.director.faucet(wallet));
      }

      if (["/health", "/status", "/radar", "/demo", "/demo/start", "/faucet"].includes(path) || m) return send(res, 405, { error: "method not allowed" }, { allow: path === "/demo/start" || path === "/faucet" ? "POST" : "GET" });
      return send(res, 404, { error: "not found" });
    } catch (e: any) {
      if (e instanceof DirectorError) return send(res, e.code === "busy" ? 409 : e.code === "unavailable" ? 503 : 400, { error: e.message });
      o.log?.(`request failed: ${String(e?.message ?? e).slice(0, 200)}`);
      return send(res, 500, { error: "something went wrong on our side" });
    }
  });
}
