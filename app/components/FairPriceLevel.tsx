"use client";
import { percentVsFair } from "@limit-plus/pricing";
import { signedPct, usd } from "@/lib/format";
import type { RoundView } from "@/lib/types";

/** A tick scale from -20% to +20% around model fair value, with a needle at the actual result. */
export default function FairPriceLevel({ round }: { round: RoundView }) {
  const paid = round.clearingPerContract ?? round.fairPerContract;
  const delta = percentVsFair(paid * 1e6, round.fairPerContract * 1e6);
  const clamped = Math.max(-20, Math.min(20, delta));
  const x = ((clamped + 20) / 40) * 100;
  const ticks = [-20, -10, 0, 10, 20];
  return (
    <div>
      <p className="text-[15px]">
        {round.clearingPerContract === undefined ? "The auction has not cleared yet. The marker shows the model's fair value." :
          delta >= 0 ? `You were paid ${Math.abs(delta).toFixed(1)}% above the model's fair value.` : `You were paid ${Math.abs(delta).toFixed(1)}% below the model's fair value.`}
      </p>
      <div className="relative mt-6 h-14" role="img" aria-label={`Result ${signedPct(delta)} versus fair value`}>
        <div className="absolute left-0 right-0 top-6 h-px bg-obsidian-3" />
        {ticks.map((t) => (
          <div key={t} className="absolute top-5" style={{ left: `${((t + 20) / 40) * 100}%` }}>
            <div className={`-translate-x-1/2 ${t === 0 ? "h-5 w-0.5 bg-bone" : "h-3 w-px bg-bone-faint"}`} />
            <span className="mono absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap text-[11px] text-bone-dim">{t === 0 ? "Fair value" : signedPct(t, 0)}</span>
          </div>
        ))}
        <div className="absolute top-0 h-12 w-0.5 -translate-x-1/2 rounded-full bg-flame" style={{ left: `${x}%` }} />
      </div>
      <details className="mt-6 text-[13px] text-bone-dim">
        <summary className="cursor-pointer text-bone">How we calculate this</summary>
        <dl className="mono mt-3 grid grid-cols-2 gap-y-1.5">
          <dt>Price now</dt><dd className="text-right text-bone">{usd(round.spot)}</dd>
          <dt>Your price</dt><dd className="text-right text-bone">{usd(round.yourPrice)}</dd>
          <dt>Volatility</dt><dd className="text-right text-bone">{(round.vol * 100).toFixed(0)}%</dd>
          <dt>Time to Friday</dt><dd className="text-right text-bone">{(round.years * 365).toFixed(1)} days</dd>
          <dt>Rate</dt><dd className="text-right text-bone">{(round.rate * 100).toFixed(1)}%</dd>
          <dt>Model</dt><dd className="text-right text-bone">Black-Scholes</dd>
        </dl>
      </details>
    </div>
  );
}
