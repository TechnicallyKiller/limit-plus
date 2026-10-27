import Link from "next/link";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { IridescentButton } from "./ui";
import { explorerTx, usd } from "@/lib/format";
import type { TicketView } from "@/lib/types";

const COPY: Record<TicketView["status"], (t: TicketView) => [string, string][]> = {
  Waiting: (t) => [[t.side === "buyLower" ? "Buy lower at" : "Sell higher at", "Your price"], ["Auction opens", "Soon"]],
  "In auction": () => [["Best bid so far", "Sealed"], ["Candle closes", "Any moment"]],
  Paid: (t) => [["You were paid", usd(t.paidNow)], ["Settles", "Friday close"]],
  Settled: (t) => [["You get", usd(t.claimable)], ["Paid earlier", usd(t.paidNow)]],
  Claimed: (t) => [["In your wallet", usd(t.amountUsd)], ["Paid earlier", usd(t.paidNow)]],
};

/** A horizontal ticket: stub (status, pool) and body (amounts, actions) split by a perforation of bone dots. */
export default function TicketCard({ t, primary, onClaim, busy }: { t: TicketView; primary?: boolean; onClaim?: () => void; busy?: boolean }) {
  const Icon = t.side === "buyLower" ? ArrowDown : ArrowUp;
  const rows = COPY[t.status](t);
  const claimable = t.status === "Paid" || t.status === "Settled";
  return (
    <article className="panel grid grid-cols-[150px_1fr] overflow-hidden max-sm:grid-cols-[110px_1fr]" aria-label={`${t.ticker} ${t.status}`}>
      <div className="relative flex flex-col justify-between p-5">
        <div><p className="text-[22px] font-semibold">{t.ticker}</p>
          <p className="flex items-center gap-1 text-[13px] text-bone-dim"><Icon size={14} aria-hidden="true" />{t.side === "buyLower" ? "Buy lower" : "Sell higher"}</p></div>
        <p className="mt-6 inline-flex w-fit rounded-full bg-obsidian-2 px-3 py-1 text-[13px]">{t.status}</p>
        <span aria-hidden="true" className="absolute inset-y-4 right-0 w-px" style={{ backgroundImage: "radial-gradient(var(--color-bone-faint) 1.2px, transparent 1.6px)", backgroundSize: "4px 10px" }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <dl className="grid grid-cols-2 gap-x-10 gap-y-1">
          {rows.map(([l, v]) => <div key={l}><dt className="text-[13px] text-bone-dim">{l}</dt><dd className="mono text-[20px]">{v}</dd></div>)}
          <div><dt className="text-[13px] text-bone-dim">Order size</dt><dd className="mono text-[16px]">{usd(t.amountUsd, 0)}</dd></div>
        </dl>
        <div className="flex flex-col items-end gap-2">
          {claimable && (primary ? <IridescentButton state={busy ? "loading" : "idle"} onClick={onClaim} className="!h-12">{busy ? "Claiming" : "Claim"}</IridescentButton>
            : <button type="button" onClick={onClaim} className="glass h-12 px-6 font-semibold">Claim</button>)}
          <Link href={`/round/${t.roundKey}`} className="text-[13px] text-bone-dim underline hover:text-flame">Open the round</Link>
          {t.txs.map((s) => <a key={s} className="mono text-[12px] text-bone-dim underline hover:text-flame" href={explorerTx(s)} target="_blank" rel="noreferrer">View on explorer</a>)}
        </div>
      </div>
    </article>
  );
}
