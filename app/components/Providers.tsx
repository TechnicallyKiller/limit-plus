"use client";
import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import "@solana/wallet-adapter-react-ui/styles.css";
import { RPC_URL } from "@/lib/chain";
import { DEMO } from "@/lib/demo";
import { DemoWalletAdapter } from "@/lib/demoWallet";

export default function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [...(DEMO ? [new DemoWalletAdapter()] : []), new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={RPC_URL || "http://127.0.0.1:8899"}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
