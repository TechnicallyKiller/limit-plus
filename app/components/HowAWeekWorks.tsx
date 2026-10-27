"use client";
import CandleRing from "./CandleRing";
import { exampleRound } from "@/lib/examples";

const STEPS = [
  ["You deposit", "Pick a pool and name your price. Your money waits in a vault only the program controls."],
  ["Market makers bid in secret", "Each one seals a bid on chain. Nobody can see anyone else's price."],
  ["The auction ends at a hidden moment", "A random close means waiting until the last second does not help."],
  ["You get paid now", "One price clears for everyone. Your share is yours to claim."],
  ["Friday's official close decides", "At or past your price you trade at it. Otherwise you get your money back."],
];

export default function HowAWeekWorks() {
  const r = exampleRound("reveal");
  const now = Math.floor(Date.now() / 1000);
  return (
    <section aria-label="How a week works" className="mx-auto grid max-w-[1440px] gap-12 px-5 py-16 md:grid-cols-[1fr_1fr] md:px-10">
      <div><h2 className="text-[32px] font-semibold">How a week works</h2>
        <ol className="mt-8 flex flex-col gap-6">
          {STEPS.map(([t, d], i) => (<li key={t} className="grid grid-cols-[40px_1fr] gap-4"><span className="mono text-[20px] text-flame">{i + 1}</span>
            <div><p className="text-[20px] font-semibold">{t}</p><p className="text-bone-dim">{d}</p></div></li>))}
        </ol></div>
      <div className="panel flex items-center justify-center p-6"><CandleRing round={r} now={now} /></div>
    </section>
  );
}
