"use client";
import { ArrowSquareOut, CalendarBlank, Coins, Newspaper, Prohibit, Question, ShieldCheck, Warning, WarningOctagon } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { EventKind, RadarSnapshot, RiskLevel } from "@limit-plus/radar/src/types";
import { ago, type RadarState } from "@/lib/radar";

const LEVEL: Record<RiskLevel, { word: string; Icon: Icon; bg: string; fg: string }> = {
  calm: { word: "Calm", Icon: ShieldCheck, bg: "var(--color-up)", fg: "var(--color-obsidian-0)" },
  watch: { word: "Watch", Icon: Warning, bg: "var(--color-amber)", fg: "var(--color-obsidian-0)" },
  high: { word: "High risk", Icon: WarningOctagon, bg: "var(--color-down)", fg: "var(--color-obsidian-0)" },
  unknown: { word: "Not checked", Icon: Question, bg: "var(--color-obsidian-3)", fg: "var(--color-bone)" },
};
const KIND: Record<EventKind, Icon> = { earnings: CalendarBlank, corporate_action: Coins, halt: Prohibit, news: Newspaper };

/** Small pill with an icon and a word, so the level never relies on color alone. */
export function RadarPill({ snap, state }: { snap?: RadarSnapshot; state: RadarState }) {
  const level: RiskLevel = snap?.level ?? "unknown";
  const { word, Icon, bg, fg } = LEVEL[level];
  const text = state === "loading" && !snap ? "Checking" : word;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold" style={{ background: bg, color: fg }} title="Risk radar">
      <Icon size={16} aria-hidden="true" />
      <span className="sr-only">Risk radar: </span>{text}
    </span>
  );
}

/** The full panel: verdict, the events behind it, and where each one came from. */
export default function RiskRadar({ ticker, snap, state, nowMs }: { ticker: string; snap?: RadarSnapshot; state: RadarState; nowMs: number }) {
  const stock = ticker.replace(/x$/, "");
  return (
    <section aria-label="Risk radar" className="panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-semibold">Risk radar</h2>
        <RadarPill snap={snap} state={state} />
      </div>

      {!snap && state === "loading" && <p role="status" className="text-bone-dim">Checking the web for news on {stock}.</p>}
      {!snap && state === "error" && <p role="status" className="text-bone-dim">The radar could not check {stock} just now. It tries again in a few minutes.</p>}

      {snap && (
        <>
          <p className="text-[17px]">{snap.headline}</p>
          {snap.failures.length > 0 && <p className="mt-1 text-[13px] text-bone-dim">Some searches failed, so this check may be incomplete.</p>}
          {snap.events.length > 0 && (
            <ul className="mt-4 flex flex-col gap-3">
              {snap.events.map((e, i) => {
                const K = KIND[e.kind];
                return (
                  <li key={`${e.kind}-${i}`} className="grid grid-cols-[20px_1fr] gap-3 text-[14px]">
                    <K size={20} aria-hidden="true" className="mt-0.5 text-bone-dim" />
                    <div>
                      <p>{e.label}</p>
                      {e.sourceUrl && (
                        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-bone-dim underline hover:text-flame">
                          {e.sourceName}<ArrowSquareOut size={12} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-[13px] text-bone-dim">
            {snap.provider === "tinyfish"
              ? `Checked ${ago(snap.asOf, nowMs)} with TinyFish web search.`
              : `Saved check from ${ago(snap.asOf, nowMs)}. The live check is not reachable right now.`}{" "}
            It reads public web pages, so open the source before you rely on it.
          </p>
        </>
      )}
    </section>
  );
}
