"use client";
import { use, useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import AuctionStage from "@/components/AuctionStage";
import BidsTable from "@/components/BidsTable";
import CandleRing from "@/components/CandleRing";
import FairPriceLevel from "@/components/FairPriceLevel";
import OrderTicket from "@/components/OrderTicket";
import PriceSpark from "@/components/PriceSpark";
import TicketSheet from "@/components/TicketSheet";
import { ExampleNote } from "@/components/ui";
import { exampleRound } from "@/lib/examples";
import { loadRound, usePolled } from "@/lib/live";
import { clock, countdown, explorerAddr, signedPct, usd } from "@/lib/format";
import type { PhaseName, RoundView } from "@/lib/types";

const PHASE: Record<PhaseName, string> = {
  deposit: "Deposits open", bidding: "Bidding", awaitingCutoff: "Closing the auction", reveal: "Revealing", awaitingClear: "Picking winners",
  noSale: "No sale", cleared: "Waiting for Friday", awaitingSettle: "Waiting for the close price", exercise: "Settling", awaitingFinalize: "Settling", finalized: "Final",
};

function target(r: RoundView): { label: string; at: number } | null {
  switch (r.phase) {
    case "deposit": return { label: "Bidding opens in", at: r.ts.bidStart };
    case "bidding": return { label: "Bidding ends within", at: r.ts.bidEnd };
    case "reveal": return { label: "Reveal ends in", at: r.ts.revealEnd };
    case "cleared": return { label: "Friday close in", at: r.ts.expiry };
    case "exercise": return { label: "Settling ends in", at: r.ts.exerciseEnd };
    default: return null;
  }
}

const day = (ts: number) => new Date(ts * 1000).toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

export default function RoundPage({ params }: { params: Promise<{ pubkey: string }> }) {
  const { pubkey } = use(params);
  const { data: round, error } = usePolled<RoundView>(() => loadRound(pubkey), exampleRound(), 2000, [pubkey]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [table, setTable] = useState(false);
  useEffect(() => { const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(id); }, []);
  const buy = round.side === "buyLower";
  const Icon = buy ? ArrowDown : ArrowUp;
  const vsNow = ((round.yourPrice - round.spot) / round.spot) * 100;
  const tgt = target(round);
  const live = !["finalized", "noSale"].includes(round.phase);
  const settled = round.settlePrice !== undefined;
  const bestRate = round.bids.filter((b) => b.revealed && b.pricePerContract).length;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pb-28 md:px-10 lg:pb-16">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-3 py-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[40px] font-semibold leading-none max-md:text-[30px]">{round.ticker}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold text-obsidian-0" style={{ background: buy ? "var(--color-volt)" : "var(--color-iris)" }}>
            <Icon size={16} aria-hidden="true" />{buy ? "Buy lower" : "Sell higher"}
          </span>
        </div>
        <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
          <div className="flex items-baseline gap-2"><dt className="text-bone-dim">Your price</dt><dd className="mono text-[22px]">{usd(round.yourPrice)}</dd></div>
          <div className="flex items-baseline gap-2"><dt className="text-bone-dim">vs now</dt><dd className="mono text-[22px]">{signedPct(vsNow)}</dd></div>
        </dl>
        <p className="ml-auto flex items-center gap-2 text-[15px]">
          {live && <span className="h-2 w-2 rounded-full bg-flame" aria-hidden="true" />}{PHASE[round.phase]}
        </p>
      </header>

      <section aria-label="Price, last 30 days" className="panel mb-6 p-5">
        <PriceSpark closes={round.spark.length ? round.spark : []} yourPrice={round.yourPrice} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <section aria-label="Sealed bids" className="panel p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-semibold">Sealed bids</h2>
                <p className="text-bone-dim">
                  {round.bids.length} market makers bid before the candle went out. {bestRate} revealed so far.
                </p>
              </div>
              {tgt && <p className="text-right"><span className="block text-bone-dim">{tgt.label}</span><span className="mono text-[24px]">{countdown(tgt.at - now)}</span></p>}
            </div>
            <AuctionStage round={round} />
            <div className="mt-3 flex items-center justify-between">
              <button type="button" className="chip text-[14px]" onClick={() => setTable((v) => !v)} aria-expanded={table} aria-controls="bids-table">{table ? "Hide table" : "Show as table"}</button>
              {round.cutoffTs && <span className="mono text-[13px] text-bone-dim">Closed at {clock(round.cutoffTs)}</span>}
            </div>
            {table && <div id="bids-table" className="mt-4"><BidsTable round={round} /></div>}
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section aria-label="This week" className="panel p-5">
              <h2 className="mb-3 text-[22px] font-semibold">This week</h2>
              <CandleRing round={round} now={now} />
              <ol className="mt-3 flex flex-col gap-2 text-[14px]">
                {[
                  ["Deposits open", day(round.ts.open)],
                  ["Candle auction, ends at a hidden moment", day(round.ts.candleStart)],
                  ["Reveal, bids open one by one", day(round.ts.bidEnd)],
                  ["Waiting for Friday's official close", day(round.ts.expiry)],
                ].map(([l, t]) => <li key={l} className="flex justify-between gap-4"><span>{l}</span><span className="mono whitespace-nowrap text-bone-dim">{t}</span></li>)}
              </ol>
            </section>
            <section aria-label={settled ? "Settlement" : "Fair-price check"} className="panel p-5">
              <h2 className="mb-3 text-[22px] font-semibold">{settled ? "Settlement" : "Fair-price check"}</h2>
              {settled ? (
                <div>
                  <p className="text-bone-dim">Friday close</p>
                  <p className="mono text-[34px]">{usd(round.settlePrice!)}</p>
                  <p className="mt-3">{round.inTheMoney ? (buy ? `The close was below your price, so you buy ${round.ticker} at ${usd(round.yourPrice)}.` : `The close was above your price, so you sell ${round.ticker} at ${usd(round.yourPrice)}.`) : "The close did not reach your price, so you get your money back."}</p>
                  <div className="mt-6"><FairPriceLevel round={round} /></div>
                </div>
              ) : <FairPriceLevel round={round} />}
            </section>
          </div>
          <p className="text-[13px] text-bone-dim">Settles at Friday's official close, 4:00 pm ET. {round.example ? "" : <a className="underline hover:text-flame" href={explorerAddr(round.key)} target="_blank" rel="noreferrer">View this round on the explorer</a>}</p>
          <ExampleNote show={round.example} />
          {error && !round.example && <p role="alert" className="text-[13px] text-down">Could not refresh this round. Showing the last good data.</p>}
        </div>

        <aside className="hidden lg:block"><div className="sticky top-6"><OrderTicket round={round} /></div></aside>
      </div>
      <TicketSheet paidNow={round.payNowTotal !== undefined ? usd(round.payNowTotal) : undefined}><OrderTicket round={round} /></TicketSheet>
    </main>
  );
}
