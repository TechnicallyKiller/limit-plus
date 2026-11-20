"use client";
import {
  BaseSignerWalletAdapter, WalletConnectionError, WalletNotConnectedError, WalletReadyState, WalletSignTransactionError, isVersionedTransaction,
  type SupportedTransactionVersions, type WalletName,
} from "@solana/wallet-adapter-base";
import { Keypair, PublicKey, Transaction, type TransactionVersion, VersionedTransaction } from "@solana/web3.js";

export const DEMO_WALLET_NAME = "Demo wallet" as WalletName<"Demo wallet">;
const STORE = "limitplus-demo-wallet";

// A plain flame-colored plus on obsidian, as a data URI so the wallet list has an icon without another request.
const ICON = "data:image/svg+xml;base64," + (typeof btoa === "function"
  ? btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0E0E13"/><path d="M28 14h8v14h14v8H36v14h-8V36H14v-8h14z" fill="#FF5B22"/></svg>')
  : "");

/**
 * A wallet that lives in this browser, for trying the demo on devnet without installing anything. The key is kept in
 * localStorage so the same wallet comes back after a reload. It only ever holds worthless test tokens; never put real
 * funds in it.
 */
export class DemoWalletAdapter extends BaseSignerWalletAdapter {
  name = DEMO_WALLET_NAME;
  url = "https://github.com/TechnicallyKiller/limit-plus";
  icon = ICON;
  supportedTransactionVersions: SupportedTransactionVersions = new Set<TransactionVersion>(["legacy"]);
  private kp: Keypair | null = null;
  private _connecting = false;

  get publicKey(): PublicKey | null { return this.kp?.publicKey ?? null; }
  get connecting() { return this._connecting; }
  get readyState() { return typeof window === "undefined" ? WalletReadyState.Unsupported : WalletReadyState.Installed; }

  private load(): Keypair {
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === 64) return Keypair.fromSecretKey(Uint8Array.from(arr));
      }
    } catch { /* unreadable or blocked storage: make a fresh one below */ }
    const fresh = Keypair.generate();
    try { window.localStorage.setItem(STORE, JSON.stringify(Array.from(fresh.secretKey))); } catch { /* works for this session only */ }
    return fresh;
  }

  async connect(): Promise<void> {
    if (this._connecting) return;
    this._connecting = true;
    try {
      this.kp = this.kp ?? this.load();
      // The wallet provider attaches its listeners in an effect that runs after a page's own effects. Announce on the
      // next tick so a connect() started from a page is not missed, and announce again if we were already connected.
      await new Promise((r) => setTimeout(r, 0));
      this.emit("connect", this.kp.publicKey);
    } catch (e: any) {
      this.emit("error", new WalletConnectionError(e?.message, e));
      throw e;
    } finally { this._connecting = false; }
  }

  async disconnect(): Promise<void> {
    if (!this.kp) return;
    this.kp = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    const kp = this.kp;
    if (!kp) throw new WalletNotConnectedError();
    try {
      if (isVersionedTransaction(tx)) tx.sign([kp]); else tx.partialSign(kp);
      return tx;
    } catch (e: any) { throw new WalletSignTransactionError(e?.message, e); }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return Promise.all(txs.map((t) => this.signTransaction(t)));
  }
}
