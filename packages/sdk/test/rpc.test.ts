import { expect } from "chai";
import { confirmByPolling, rpcFetch } from "../src";

const res = (status: number, headers: Record<string, string> = {}) => ({ status, ok: status < 400, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as Response;
const noSleep = async () => {};

describe("rpcFetch", () => {
  it("retries 429s with backoff and returns the first good answer", async () => {
    let n = 0; const waits: number[] = [];
    const f = rpcFetch({ fetchImpl: (async () => (++n < 3 ? res(429) : res(200))) as any, sleep: async (ms) => { waits.push(ms); }, random: () => 0.5 });
    expect((await f("http://rpc")).status).to.equal(200);
    expect(n).to.equal(3);
    expect(waits).to.deep.equal([400, 800]);
  });
  it("honours Retry-After, capped", async () => {
    let n = 0; const waits: number[] = [];
    const f = rpcFetch({ maxDelayMs: 5000, fetchImpl: (async () => (++n === 1 ? res(429, { "retry-after": "30" }) : res(200))) as any, sleep: async (ms) => { waits.push(ms); } });
    await f("http://rpc");
    expect(waits).to.deep.equal([5000]);
  });
  it("retries 5xx and network errors, but not other 4xx", async () => {
    let n = 0;
    expect((await rpcFetch({ fetchImpl: (async () => (++n === 1 ? res(503) : res(200))) as any, sleep: noSleep })("u")).status).to.equal(200);
    n = 0;
    expect((await rpcFetch({ fetchImpl: (async () => { if (++n === 1) throw new Error("reset"); return res(200); }) as any, sleep: noSleep })("u")).status).to.equal(200);
    n = 0;
    expect((await rpcFetch({ fetchImpl: (async () => { n++; return res(404); }) as any, sleep: noSleep })("u")).status).to.equal(404);
    expect(n).to.equal(1);
  });
  it("gives the last answer back after the retries run out, instead of throwing", async () => {
    let n = 0;
    const out = await rpcFetch({ maxRetries: 3, fetchImpl: (async () => { n++; return res(429); }) as any, sleep: noSleep })("u");
    expect(out.status).to.equal(429); expect(n).to.equal(4);
    await rpcFetch({ maxRetries: 2, fetchImpl: (async () => { throw new Error("down"); }) as any, sleep: noSleep })("u").then(() => expect.fail(), (e) => expect(e.message).to.equal("down"));
  });
  it("does not retry an aborted request", async () => {
    let n = 0;
    await rpcFetch({ fetchImpl: (async () => { n++; const e: any = new Error("aborted"); e.name = "AbortError"; throw e; }) as any, sleep: noSleep })("u").then(() => expect.fail(), (e) => expect(e.name).to.equal("AbortError"));
    expect(n).to.equal(1);
  });
  it("paces concurrent requests so they cannot burst", async () => {
    // Four callers arrive at the same instant. The first goes at once, the others are queued 100 ms apart.
    const waits: number[] = [];
    const f = rpcFetch({ minGapMs: 100, now: () => 1000, sleep: async (ms) => { waits.push(ms); }, fetchImpl: (async () => res(200)) as any });
    await Promise.all([f("a"), f("b"), f("c"), f("d")]);
    expect(waits).to.deep.equal([100, 200, 300]);
  });
  it("applies no pacing when the gap is 0", async () => {
    const waits: number[] = [];
    const f = rpcFetch({ minGapMs: 0, sleep: async (ms) => { waits.push(ms); }, fetchImpl: (async () => res(200)) as any });
    await Promise.all([f("a"), f("b"), f("c")]);
    expect(waits).to.deep.equal([]);
  });
});

describe("confirmByPolling", () => {
  const conn = (answers: any[]) => { let i = 0; return { getSignatureStatuses: async () => { const a = answers[Math.min(i++, answers.length - 1)]; if (a instanceof Error) throw a; return { value: [a] }; } } as any; };
  it("returns once the signature is confirmed", async () => {
    await confirmByPolling(conn([null, { confirmationStatus: "processed", err: null }, { confirmationStatus: "confirmed", err: null }]), "sig", { sleep: noSleep });
  });
  it("throws if the transaction failed on chain", async () => {
    await confirmByPolling(conn([{ confirmationStatus: "confirmed", err: { InstructionError: [0, { Custom: 1 }] } }]), "sig", { sleep: noSleep }).then(() => expect.fail(), (e) => expect(e.message).to.contain("failed on chain"));
  });
  it("keeps polling through a flaky endpoint, then times out clearly", async () => {
    let clock = 0;
    await confirmByPolling(conn([new Error("429"), new Error("429")]), "sig", { timeoutMs: 5000, now: () => clock, sleep: async (ms) => { clock += ms; } }).then(() => expect.fail(), (e) => expect(e.message).to.contain("not confirmed"));
    await confirmByPolling(conn([new Error("429"), { confirmationStatus: "finalized", err: null }]), "sig", { sleep: noSleep });
  });
  it("only returns on finalized when finalized is asked for", async () => {
    let clock = 0;
    await confirmByPolling(conn([{ confirmationStatus: "confirmed", err: null }]), "sig", { commitment: "finalized", timeoutMs: 3000, now: () => clock, sleep: async (ms) => { clock += ms; } }).then(() => expect.fail(), (e) => expect(e.message).to.contain("not confirmed"));
  });
});
