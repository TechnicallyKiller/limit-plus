import type { RoundView } from "@/lib/types";
import { clock, pct, shortKey, usd } from "@/lib/format";

export default function BidsTable({ round }: { round: RoundView }) {
  const cutoff = round.cutoffTs;
  const order = [...round.bids].sort((a, b) => (b.pricePerContract ?? -1) - (a.pricePerContract ?? -1));
  const perContract = round.yourPrice * round.sharesPerContract;
  return (
    <div role="region" aria-label="Bids" tabIndex={0} className="max-h-[360px] overflow-auto rounded-[18px]">
      <table className="w-full text-left text-[14px]">
        <caption className="sr-only">Bids placed in this round</caption>
        <thead className="sticky top-0 bg-obsidian-1 text-bone-dim"><tr>
          <th scope="col" className="p-3 font-medium">Bidder</th><th scope="col" className="p-3 font-medium">Placed</th>
          <th scope="col" className="p-3 text-right font-medium">Rate a week</th><th scope="col" className="p-3 text-right font-medium">Per contract</th>
          <th scope="col" className="p-3 text-right font-medium">Contracts</th><th scope="col" className="p-3 font-medium">Result</th></tr></thead>
        <tbody>{order.map((b) => {
          const late = cutoff !== undefined && b.commitTs > cutoff;
          const result = !b.revealed ? "Not revealed" : late ? "After the close" : b.wonQty ? `Won ${b.wonQty}` : b.valid ? "Waiting" : "Below the minimum";
          return (<tr key={b.bidder} className="border-t border-bone/10">
            <td className="mono p-3">{shortKey(b.bidder)}</td><td className="mono p-3 text-bone-dim">{clock(b.commitTs)}</td>
            <td className="mono p-3 text-right">{b.revealed && b.pricePerContract !== undefined ? pct((b.pricePerContract / perContract) * 100) : "Sealed"}</td>
            <td className="mono p-3 text-right">{b.revealed && b.pricePerContract !== undefined ? usd(b.pricePerContract, 4) : "Sealed"}</td>
            <td className="mono p-3 text-right">{b.revealed ? b.qty : "Sealed"}</td><td className="p-3">{result}</td></tr>);
        })}</tbody>
      </table>
    </div>
  );
}
