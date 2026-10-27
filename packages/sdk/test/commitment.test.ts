import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import { computeCommitment } from "../src";

// X1: must equal COMMITMENT_VECTOR in programs/limit_plus/src/math.rs (U7).
describe("X1 commitment hash", () => {
  it("matches the Rust vector", () => {
    const round = new PublicKey(new Uint8Array(32).fill(1));
    const bidder = new PublicKey(new Uint8Array(32).fill(2));
    const h = computeCommitment(round, bidder, 123456, 7, new Uint8Array(32).fill(9));
    expect(h.toString("hex")).to.equal("ee711ac9e48202ee1e5703540df8703cf36022706a0a921f6e4c1b0eeda3aadc");
  });
});
