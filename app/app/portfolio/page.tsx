"use client";
import Link from "next/link";
import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import TicketCard from "@/components/TicketCard";
import { IridescentButton, ExampleNote } from "@/components/ui";
import { claimAll } from "@/lib/actions";
import { loadTickets, usePolled } from "@/lib/live";
import { EXAMPLE_TICKETS } from "@/lib/examples";
import { usd } from "@/lib/format";
import type { TicketView } from "@/lib/types";
import { hasChain } from "@/lib/chain";

export default function PortfolioPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { data: tickets } = usePolled<TicketView[]>(async () => (publicKey || !hasChain ? loadTickets(publicKey!) : []), hasChain ? [] : EXAMPLE_TICKETS, 2000, [publicKey?.toBase58()]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const paid = tickets.reduce((a, t) => a + t.paidNow, 0);
  const waiting = tickets.filter((t) => ["Waiting", "In auction", "Paid"].includes(t.status)).reduce((a, t) => a + t.amountUsd, 0);
  const claimable = tickets.reduce((a, t) => a + t.claimable, 0);
  const firstClaimable = tickets.find((t) => t.status === "Paid" || t.status === "Settled");

  const claim = async (t: TicketView) => {
    if (!publicKey) { setVisible(true); return; }
    if (t.example) { setMsg("This is an example ticket."); return; }
    setBusy(t.id); setMsg(null);
    try { await claimAll(connection, publicKey, (tx, c) => sendTransaction(tx, c), t.roundKey); }
    catch (e: any) { setMsg(`The claim did not go through: ${String(e?.message ?? e).slice(0, 140)}. Try again in a moment.`); }
    setBusy(null);
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 pb-16 md:px-10">
      <h1 className="sr-only">Portfolio</h1>
      <section aria-label="Totals" className="grid gap-6 border-b border-bone/10 py-8 sm:grid-cols-3">
        <div><p className="text-bone-dim">Paid to you so far</p><p className="mono text-[40px] leading-none text-amber">{usd(paid)}</p></div>
        <div><p className="text-bone-dim">Waiting</p><p className="mono text-[40px] leading-none">{usd(waiting, 0)}</p></div>
        <div><p className="text-bone-dim">Claimable</p><p className="mono text-[40px] leading-none">{usd(claimable)}</p></div>
      </section>
      <section aria-label="Tickets" className="mt-8 flex flex-col gap-4">
        {!publicKey && hasChain ? (
          <div className="panel flex flex-col items-start gap-4 p-8"><p className="text-[18px]">Connect a wallet to see your orders.</p>
            <button type="button" className="glass h-12 px-6 font-semibold" onClick={() => setVisible(true)}>Connect wallet</button></div>
        ) : tickets.length === 0 ? (
          <div className="panel flex flex-col items-start gap-4 p-8"><p className="text-[18px]">No orders yet. Pick a pool and name your price.</p>
            <Link href="/pools" className="rim inline-flex h-14 items-center px-8 text-[16px]">Open the pools board</Link></div>
        ) : tickets.map((t) => <TicketCard key={t.id} t={t} primary={t.id === firstClaimable?.id} busy={busy === t.id} onClaim={() => claim(t)} />)}
        {msg && <p role="alert" className="text-[13px] text-down">{msg}</p>}
        <ExampleNote show={tickets.length > 0 && tickets.every((t) => t.example)} />
      </section>
    </main>
  );
}
