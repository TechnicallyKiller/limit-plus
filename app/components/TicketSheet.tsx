"use client";
import { ReactNode, useRef } from "react";
import { X } from "@phosphor-icons/react";

/** Mobile: the order ticket becomes a bottom sheet that animates in and out of the top layer. */
export default function TicketSheet({ children, paidNow }: { children: ReactNode; paidNow?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <div className="glass fixed inset-x-4 bottom-4 z-30 flex items-center justify-between gap-4 py-2 pl-6 pr-2 lg:hidden">
        <div><p className="text-[12px] text-bone-dim">Paid now</p><p className={`mono text-amber ${paidNow ? "text-[18px]" : "text-[14px]"}`}>{paidNow ?? "At the auction"}</p></div>
        <button type="button" onClick={() => ref.current?.showModal()} className="rim h-12 px-7 text-[16px]">Deposit</button>
      </div>
      <dialog ref={ref} aria-label="Order ticket" className="sheet" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="mb-3 flex justify-end"><button type="button" aria-label="Close" className="chip" onClick={() => ref.current?.close()}><X size={18} /></button></div>
        {children}
      </dialog>
    </>
  );
}
