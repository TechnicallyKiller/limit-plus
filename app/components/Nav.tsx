"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet } from "@phosphor-icons/react";
import { shortKey } from "@/lib/format";

const links = [
  { href: "/pools", label: "Pools" },
  { href: "/round/demo", label: "Rounds" },
  { href: "/portfolio", label: "Portfolio" },
];

export default function Nav() {
  const path = usePathname();
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  return (
    <header className="relative z-20 mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-2 px-4 md:px-10">
      <Link href="/" className="display text-[22px]" style={{ fontStretch: "125%" }}>
        limit<span className="text-flame">+</span>
      </Link>
      <nav aria-label="Main" className="glass flex items-center gap-1 p-1.5">
        {links.map((l) => {
          const active = path === l.href || (l.href !== "/" && path.startsWith(l.href.split("/").slice(0, 2).join("/")));
          return (
            <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
              className={`rounded-full px-4 py-2.5 text-[15px] font-semibold max-sm:px-3 ${l.label === "Rounds" ? "max-sm:hidden " : ""}${active ? "bg-bone text-obsidian-0" : "text-bone-dim hover:text-bone"}`}>
              {l.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => (publicKey ? disconnect() : setVisible(true))}
          className="mono ml-1 inline-flex h-10 items-center gap-2 rounded-full border border-bone/20 bg-bone/5 px-4 max-sm:px-3 text-[13px] text-bone hover:bg-bone/10">
          <Wallet size={18} aria-hidden="true" />
          <span className="max-sm:sr-only">{publicKey ? shortKey(publicKey.toBase58()) : connecting ? "Connecting" : "Connect wallet"}</span>
        </button>
      </nav>
    </header>
  );
}
