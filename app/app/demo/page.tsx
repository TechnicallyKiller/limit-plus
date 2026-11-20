"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { CheckCircle, Flask } from "@phosphor-icons/react";
import { IridescentButton, SegmentedControl } from "@/components/ui";
import { DEMO, DemoError, requestTestFunds, startDemoWeek, useDemoState, type DemoOutcome } from "@/lib/demo";
import { DEMO_WALLET_NAME } from "@/lib/demoWallet";
import { countdown, shortKey, usd } from "@/lib/format";
import { useNow } from "@/lib/live";

const PHASE: Record<string, string> = {
  deposit: "Deposits open", bidding: "Market makers are bidding", awaitingCutoff: "Closing the auction", reveal: "Revealing bids", awaitingClear: "Picking winners",
  noSale: "No sale", cleared: "Waiting for Friday", awaitingSettle: "Waiting for the close price", exercise: "Settling", awaitingFinalize: "Settling", finalized: "Final",
};
/** Source text can contain typographic dashes. The design bans them in rendered text. */
const plain = (s: string) => s.replace(/\s*[–—]\s*/g, " - ");

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "done"; msg: string } | { kind: "error"; msg: string };

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[40px_1fr] gap-4">
      <span className="mono pt-0.5 text-[20px] text-flame" aria-hidden="true">{n}</span>
      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-[20px] font-semibold">
          {title}{done && <><CheckCircle size={20} weight="regular" className="text-up" aria-hidden="true" /><span className="sr-only">Done</span></>}
        </h3>
        {children}
      </div>
    </li>
  );
}

export default function DemoPage() {
  const now = useNow();
  const { publicKey, wallet, select, connect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { state, unavailable } = useDemoState();
  const [outcome, setOutcome] = useState<DemoOutcome>("buy");
  const [funds, setFunds] = useState<Status>({ kind: "idle" });
  const [start, setStart] = useState<Status>({ kind: "idle" });
  const wantDemo = useRef(false);

  // Selecting the demo wallet is not enough on its own; connect once it is the selected adapter.
  useEffect(() => {
    if (wantDemo.current && wallet?.adapter.name === DEMO_WALLET_NAME && !publicKey && !connecting) connect().catch(() => undefined);
  }, [wallet, publicKey, connecting, connect]);

  if (!DEMO) {
    return (
      <main className="mx-auto w-full max-w-[720px] px-5 pb-16 pt-10 md:px-10">
        <h1 className="text-[32px] font-semibold">Demo week</h1>
        <p className="mt-3 text-bone-dim">The demo is not turned on for this deployment.</p>
        <Link href="/pools" className="chip mt-6 inline-flex">Open the pools board</Link>
      </main>
    );
  }

  const running = state?.status === "running";
  const live = running && state?.phase && !["finalized", "noSale"].includes(state.phase);
  const inDeposit = state?.phase === "deposit";
  const depositLeft = state?.bidStartTs ? state.bidStartTs - now : 0;
  const finished = state?.status === "finished" || state?.phase === "finalized";

  const takeFunds = async () => {
    if (!publicKey) return;
    setFunds({ kind: "loading" });
    try {
      const r = await requestTestFunds(publicKey.toBase58());
      setFunds({ kind: "done", msg: `You have ${r.usdc.toLocaleString("en-US")} test USDC${r.sol > 0 ? " and a little SOL for fees" : ""}.` });
    } catch (e) { setFunds({ kind: "error", msg: e instanceof DemoError ? e.message : "Something went wrong. Try again." }); }
  };
  const startWeek = async () => {
    setStart({ kind: "loading" });
    try { await startDemoWeek(outcome, 90); setStart({ kind: "done", msg: "The week has started." }); }
    catch (e) { setStart({ kind: "error", msg: e instanceof DemoError ? e.message : "Something went wrong. Try again." }); }
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 pb-20 md:px-10">
      <header className="py-8">
        <h1 className="text-[40px] font-semibold leading-none max-md:text-[30px]">Demo week</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] text-bone-dim">A whole week of Limit+ in about three minutes. Name a price, watch market makers bid in secret, and see what you get paid.</p>
        <p className="mt-3 inline-flex items-start gap-2 text-[13px] text-bone-dim"><Flask size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>Devnet only. The money is test money with no value, and the Friday price is simulated so a week fits in minutes.</span></p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <section aria-label="Steps" className="panel p-6">
          <ol className="flex flex-col gap-8">
            <Step n={1} title="Connect a wallet" done={!!publicKey}>
              {publicKey ? <p className="text-bone-dim">Connected as <span className="mono text-bone">{shortKey(publicKey.toBase58())}</span>.</p> : (
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="rim h-12 px-6 text-[15px]" onClick={() => { wantDemo.current = true; select(DEMO_WALLET_NAME); }}>Use the demo wallet</button>
                  <button type="button" className="chip" onClick={() => setVisible(true)}>Use my own wallet</button>
                </div>
              )}
              {!publicKey && <p className="text-[13px] text-bone-dim">The demo wallet lives in this browser and needs no install.</p>}
            </Step>

            <Step n={2} title="Get test funds" done={funds.kind === "done"}>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="chip" disabled={!publicKey || funds.kind === "loading"} onClick={takeFunds}>
                  {funds.kind === "loading" ? "Sending" : "Get 1,000 test USDC"}
                </button>
                {funds.kind === "done" && <p className="text-[14px] text-bone-dim">{funds.msg}</p>}
              </div>
              {funds.kind === "error" && <p role="alert" className="text-[13px] text-down">{funds.msg}</p>}
              {!publicKey && <p className="text-[13px] text-bone-dim">Connect a wallet first.</p>}
            </Step>

            <Step n={3} title="Start a demo week" done={running || finished}>
              {running || finished ? (
                <p className="text-bone-dim">{running ? "A week is running. Join it below." : "The last week is over. You can start another."}</p>
              ) : null}
              {!running && (
                <>
                  <SegmentedControl<DemoOutcome> label="How the week ends" value={outcome} onChange={setOutcome}
                    options={[{ value: "buy", label: "Stock falls, you buy" }, { value: "skip", label: "Stock rises, money back" }]} />
                  <p className="text-[13px] text-bone-dim">{outcome === "buy" ? "The Friday price lands below your price, so you buy the stock at your price." : "The Friday price lands above your price, so you get your money back. You keep the payment either way."}</p>
                  <div><IridescentButton state={start.kind === "loading" ? "loading" : "idle"} onClick={startWeek} className="h-12 px-6 text-[15px]">{start.kind === "loading" ? "Starting" : "Start a demo week"}</IridescentButton></div>
                </>
              )}
              {start.kind === "error" && <p role="alert" className="text-[13px] text-down">{start.msg}</p>}
            </Step>

            <Step n={4} title="Name your price" done={!!state?.roundKey && !inDeposit}>
              {inDeposit && state?.roundKey ? (
                <>
                  <p className="text-bone-dim">Deposits close in <span className="mono text-bone">{countdown(Math.max(depositLeft, 0))}</span>. Your price is {state.yourPrice ? <span className="mono text-bone">{usd(state.yourPrice)}</span> : "set"}, 5% below the stock.</p>
                  <div><Link href={`/round/${state.roundKey}`} className="rim inline-flex h-12 items-center px-6 text-[15px]">Open the round and deposit</Link></div>
                </>
              ) : state?.roundKey ? (
                <>
                  <p className="text-bone-dim">Deposits are closed. Watch the auction on the round page.</p>
                  <div><Link href={`/round/${state.roundKey}`} className="chip inline-flex">Open the round</Link></div>
                </>
              ) : <p className="text-bone-dim">Start a week first.</p>}
            </Step>

            <Step n={5} title="Collect" done={false}>
              <p className="text-bone-dim">{state?.roundKey && ["cleared", "awaitingSettle", "exercise", "awaitingFinalize", "finalized"].includes(state.phase ?? "") ? "The auction has cleared. Your payment is ready, and the rest follows Friday's close." : "After the auction clears, your payment is ready to claim."}</p>
              <div><Link href="/portfolio" className="chip inline-flex">Open your portfolio</Link></div>
            </Step>
          </ol>
        </section>

        <section aria-label="Live" className="panel flex flex-col gap-4 p-6 lg:self-start">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[22px] font-semibold">What is happening</h2>
            {state?.phase && <p className="flex items-center gap-2 text-[15px]">{live && <span className="h-2 w-2 rounded-full bg-flame" aria-hidden="true" />}{PHASE[state.phase] ?? state.phase}</p>}
          </div>
          {unavailable && <p role="status" className="text-[14px] text-bone-dim">The demo service is not reachable right now. This page keeps trying.</p>}
          {!unavailable && !state && <p role="status" className="text-bone-dim">Connecting to the demo service.</p>}
          {state && state.status === "idle" && <p className="text-bone-dim">No week is running. Start one and the market makers join in.</p>}
          {state?.status === "failed" && <p role="alert" className="text-[14px] text-down">This week hit a problem: {plain(state.error ?? "unknown")}. Start a new one.</p>}
          {state?.spot !== undefined && (
            <dl className="grid grid-cols-2 gap-y-2 text-[14px]">
              <dt className="text-bone-dim">NVDAx price</dt><dd className="mono text-right">{usd(state.spot)}</dd>
              {state.yourPrice !== undefined && <><dt className="text-bone-dim">Your price</dt><dd className="mono text-right">{usd(state.yourPrice)}</dd></>}
              {state.closePrice !== undefined && <><dt className="text-bone-dim">Friday close</dt><dd className="mono text-right">{usd(state.closePrice)}</dd></>}
            </dl>
          )}
          {state && state.feed.length > 0 && (
            <div>
              <h3 className="mb-2 text-[15px] font-semibold">Market makers and keeper</h3>
              <ol aria-label="Activity" className="mono flex max-h-[300px] flex-col gap-1.5 overflow-y-auto text-[12px] text-bone-dim">
                {state.feed.slice(-14).map((l, i) => <li key={`${i}-${l}`}>{plain(l)}</li>)}
              </ol>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
