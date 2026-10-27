"use client";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { IridescentButton, SegmentedControl } from "./ui";
import { deposit } from "@/lib/actions";
import { explorerTx, usd } from "@/lib/format";
import type { RoundView } from "@/lib/types";

const FEE = 0.1;

export default function OrderTicket({ round }: { round: RoundView }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const buy = round.side === "buyLower";
  const [amount, setAmount] = useState("1000");
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [otherSide, setOtherSide] = useState(false);

  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!publicKey || round.example) { setBalance(null); return; }
    let live = true;
    (async () => {
      try {
        const accs = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(round.collateralMint ?? "") });
        const t = accs.value.reduce((a, x) => a + (x.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
        if (live) setBalance(buy ? t : t * round.yourPrice);
      } catch { if (live) setBalance(null); }
    })();
    return () => { live = false; };
  }, [publicKey, connection, round.example, round.collateralMint, buy, round.yourPrice]);
  const value = Number(amount);
  const strikePerContract = round.yourPrice * round.sharesPerContract;
  const contracts = Number.isFinite(value) && value > 0 ? Math.floor(value / strikePerContract) : 0;
  const locked = round.phase !== "deposit";
  const invalid = amount !== "" && (!Number.isFinite(value) || value <= 0 || contracts < 1);
  const exact = round.clearingPerContract !== undefined;
  const lowPerContract = round.reservePerContract, highPerContract = round.fairPerContract * 1.2;
  const payNow = exact ? round.clearingPerContract! * contracts * (1 - FEE) : 0;
  const payLow = lowPerContract * contracts * (1 - FEE), payHigh = highPerContract * contracts * (1 - FEE);
  const shares = contracts * round.sharesPerContract;
  const paidLine = exact ? `+ the ${usd(payNow)} you were paid` : "+ the payment you get now";

  const submit = async () => {
    setError(null);
    if (!publicKey) { setVisible(true); return; }
    if (round.example) { setError("This is an example round. Open a live round to deposit."); return; }
    if (invalid || contracts < 1) { setError(`Amount is below one contract (${usd(strikePerContract)}). Raise it and try again.`); return; }
    setState("loading");
    try {
      const s = await deposit(connection, publicKey, (tx, c) => sendTransaction(tx, c), round.key, contracts);
      setSig(s); setState("success"); setTimeout(() => setState("idle"), 900);
    } catch (e: any) { setState("idle"); setError(`The deposit did not go through: ${String(e?.message ?? e).slice(0, 140)}. Check your balance and try again.`); }
  };

  return (
    <div className="glass flex flex-col gap-5 p-6" style={{ borderRadius: "var(--radius-panel)" }}>
      <SegmentedControl label="Order side" value={round.side}
        onChange={(v) => setOtherSide(v !== round.side)}
        options={[{ value: "buyLower", label: "Buy lower" }, { value: "sellHigher", label: "Sell higher" }]} />
      {otherSide && <p className="text-[13px] text-bone-dim">The other side is its own pool. Find it on the pools board.</p>}
      <div className="field">
        <label htmlFor="amount" className="text-bone-dim">Amount</label>
        <div className="relative">
          <input id="amount" inputMode="decimal" className="mono w-full pr-32" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={invalid || (balance !== null && value > balance)} aria-describedby="amount-help" />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <button type="button" className="chip text-[12px]" disabled={balance === null} onClick={() => balance !== null && setAmount(String(Math.floor(balance * 100) / 100))}>Max</button>
            <span className="mono text-[13px] text-bone-dim">USDC</span>
          </div>
        </div>
        <p id="amount-help" className={`text-[13px] ${invalid ? "text-down" : "text-bone-dim"}`}>
          {invalid ? `Amount is below one contract (${usd(strikePerContract)}). Raise it and try again.` : balance !== null && value > balance ? `Amount is above your USDC balance (${balance.toFixed(2)}). Lower it or add funds.` : `${contracts} contracts at ${usd(strikePerContract)} each.`}
        </p>
        <div className="flex gap-2">{[100, 500, 1000].map((v) => <button key={v} type="button" className="chip mono text-[13px]" onClick={() => setAmount(String(v))}>{v.toLocaleString("en-US")}</button>)}</div>
      </div>
      <div>
        <p className="text-bone-dim">You get paid now</p>
        <p className="mono whitespace-nowrap text-[26px] font-medium leading-tight text-amber xl:text-[28px]">{exact ? usd(payNow) : `${usd(payLow)} to ${usd(payHigh)}`}</p>
        {!exact && <p className="text-[13px] text-bone-dim">Decided at the auction, then yours to claim.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3" aria-label="Two possible Fridays">
        <div className="rounded-[18px] bg-obsidian-2 p-4">
          <p className="text-[13px] text-bone-dim">{buy ? `If ${round.ticker.replace("x", "")} closes at or below ${usd(round.yourPrice)}` : `If it closes above ${usd(round.yourPrice)}`}</p>
          <p className="mono mt-2 text-[16px] leading-snug">{buy ? `${shares.toFixed(2)} ${round.ticker}` : usd(contracts * strikePerContract)}</p>
          <p className="mt-1 text-[13px] text-amber">{paidLine}</p>
        </div>
        <div className="rounded-[18px] bg-obsidian-2 p-4">
          <p className="text-[13px] text-bone-dim">{buy ? "If it closes above" : `If it closes at or below ${usd(round.yourPrice)}`}</p>
          <p className="mono mt-2 text-[16px] leading-snug">{buy ? `${usd(value || 0, 0)} back` : `${shares.toFixed(2)} ${round.ticker} back`}</p>
          <p className="mt-1 text-[13px] text-amber">{paidLine}</p>
        </div>
      </div>
      <p className="text-[14px] text-bone-dim">{buy ? "If the price falls far below your price, you still buy at your price." : "If the price rises far above your price, you still sell at your price."}</p>
      <IridescentButton state={state} onClick={submit} disabled={locked}>
        {locked ? "Locked" : state === "loading" ? "Depositing" : state === "success" ? "Deposited" : publicKey ? "Deposit" : "Connect wallet to deposit"}
      </IridescentButton>
      {error && <p role="alert" className="text-[13px] text-down">{error}</p>}
      {sig && <a className="mono text-[13px] text-bone-dim underline hover:text-flame" href={explorerTx(sig)} target="_blank" rel="noreferrer">View the deposit on the explorer</a>}
    </div>
  );
}
