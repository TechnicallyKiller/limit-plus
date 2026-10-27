import Link from "next/link";
import HalftoneWordmark from "@/components/HalftoneWordmark";
import LandingBoard from "@/components/LandingBoard";
import HowAWeekWorks from "@/components/HowAWeekWorks";

export default function Landing() {
  return (
    <main>
      <section className="dotfield relative overflow-hidden pb-16 pt-6">
        <div className="mx-auto max-w-[1440px] px-5 md:px-10">
          <HalftoneWordmark />
          <p className="mt-10 max-w-[720px] text-[32px] font-semibold leading-[1.1] md:text-[48px]">Name your price for a stock. Get paid while you wait.</p>
          <p className="mt-4 max-w-[560px] text-bone-dim">Pick a price for a tokenized stock. Market makers pay you now for the chance to trade at it. At Friday's official close you either get the stock at your price or your money back.</p>
          <Link href="/pools" className="rim mt-8 inline-flex h-14 items-center px-8 text-[16px]">Open the pools board</Link>
        </div>
      </section>
      <section aria-label="Live pools" className="mx-auto max-w-[1440px] px-5 py-16 md:px-10"><LandingBoard /></section>
      <HowAWeekWorks />
      <footer className="mx-auto max-w-[1440px] border-t border-bone/10 px-5 py-10 text-[14px] text-bone-dim md:px-10">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <a className="hover:text-bone" href="https://github.com/TechnicallyKiller/limit-plus" target="_blank" rel="noreferrer">GitHub</a>
          <a className="hover:text-bone" href="https://github.com/TechnicallyKiller/limit-plus/blob/master/docs/SPEC.md" target="_blank" rel="noreferrer">Docs</a>
          <span>Prices from Pyth</span>
        </div>
        <p className="mt-4 max-w-[720px]">Limit+ is a prototype. Prices and payments shown with example numbers are examples. Trading tokenized stocks carries risk, and you can end up holding the stock at your price.</p>
      </footer>
    </main>
  );
}
