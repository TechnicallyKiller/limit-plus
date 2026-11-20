import { expect } from "chai";
import { fetchSpot } from "../src";

const FEED = "b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593";
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const no = (status: number) => ({ ok: false, status, json: async () => ({}) }) as unknown as Response;
const pythBody = { parsed: [{ price: { price: "14598000", expo: -5, publish_time: 1795122001 } }] };
const yahooBody = (p: unknown) => ({ chart: { result: [{ meta: { regularMarketPrice: p, regularMarketTime: 1795122001 } }] } });
const route = (map: { pyth?: () => Response | Promise<Response>; yahoo?: () => Response | Promise<Response> }) => (async (url: string) => {
  if (url.includes("hermes")) return map.pyth ? map.pyth() : no(401);
  if (url.includes("yahoo")) return map.yahoo ? map.yahoo() : no(500);
  throw new Error("unexpected url " + url);
}) as unknown as typeof fetch;

describe("spot price", () => {
  it("uses Pyth when it answers", async () => {
    const s = await fetchSpot({ feedHex: FEED, symbol: "NVDA" }, route({ pyth: () => ok(pythBody) }), {});
    expect(s.source).to.equal("pyth"); expect(s.price).to.be.closeTo(145.98, 1e-6);
  });
  it("falls back to Yahoo when Pyth says 401 (what the public endpoint does today)", async () => {
    const s = await fetchSpot({ feedHex: FEED, symbol: "NVDA" }, route({ yahoo: () => ok(yahooBody(145.98)) }), {});
    expect(s.source).to.equal("yahoo"); expect(s.price).to.equal(145.98);
  });
  it("falls back to Yahoo when Pyth throws or times out", async () => {
    const s = await fetchSpot({ feedHex: FEED, symbol: "NVDA" }, route({ pyth: () => { throw new Error("offline"); }, yahoo: () => ok(yahooBody(150)) }), {});
    expect(s.source).to.equal("yahoo");
  });
  it("rejects implausible prices from either source instead of passing them on", async () => {
    for (const bad of [0, -3, NaN, null, "145", 1e9, 0.01]) {
      await fetchSpot({ symbol: "NVDA" }, route({ yahoo: () => ok(yahooBody(bad)) }), {}).then(() => expect.fail(`accepted ${String(bad)}`), (e) => expect(e.message).to.contain("no price source"));
    }
    await fetchSpot({ feedHex: FEED }, route({ pyth: () => ok({ parsed: [{ price: { price: "1", expo: -9 } }] }) }), {}).then(() => expect.fail("accepted a dust price"), (e) => expect(e.message).to.contain("no plausible price"));
  });
  it("throws a clear error when nothing answers", async () => {
    await fetchSpot({ feedHex: FEED, symbol: "NVDA" }, route({}), {}).then(() => expect.fail(), (e) => { expect(e.message).to.contain("pyth 401"); expect(e.message).to.contain("yahoo 500"); });
    await fetchSpot({}, route({}), {}).then(() => expect.fail(), (e) => expect(e.message).to.contain("nothing to try"));
  });
  it("refuses a symbol that could change the URL", async () => {
    let called = false;
    await fetchSpot({ symbol: "NVDA/../../x" }, (async () => { called = true; return ok(yahooBody(100)); }) as any, {}).then(() => expect.fail(), () => undefined);
    expect(called).to.equal(false);
  });
  it("sends the Pyth key as a header when one is configured", async () => {
    let seen: any;
    await fetchSpot({ feedHex: FEED }, (async (_u: string, init: any) => { seen = init.headers; return ok(pythBody); }) as any, { PYTH_API_KEY: "k" });
    expect(seen["x-api-key"]).to.equal("k");
  });
});
