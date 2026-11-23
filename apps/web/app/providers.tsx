"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import "@solana/wallet-adapter-react-ui/styles.css";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import type { WalletError } from "@solana/wallet-adapter-base";
import { SessionProvider } from "@/components/SessionProvider";
import { I18nProvider, useI18n } from "@/lib/i18n";

const RAW_RPC = (process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "").trim();
const RPC = /^https?:\/\//.test(RAW_RPC) ? RAW_RPC : "https://api.devnet.solana.com";

/** Affiche l'erreur réelle d'un wallet (connexion refusée, wallet non Solana…) au lieu de ne rien faire. */
function WalletErrorBanner({ text, close }: { text: string; close: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-red-400/50 bg-night/95 p-4 text-sm text-slate-100 shadow-lg backdrop-blur">
      <p className="font-semibold text-red-300">{t("wallet.error")}</p>
      <p className="mt-1 break-words text-xs text-slate-300">{text}</p>
      <p className="mt-2 text-xs text-slate-200">{t("wallet.hint")}</p>
      <button onClick={close} className="mt-3 min-h-11 w-full rounded-full border border-white/25 px-4 text-sm font-semibold text-white">{t("install.close")}</button>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const onError = useCallback((e: WalletError) => {
    // Fermeture ou refus volontaire dans le wallet : pas une erreur à montrer.
    if (/reject|cancel|closed|denied/i.test(e.message)) return;
    setWalletErr(`${e.name}: ${e.message || "—"}`);
  }, []);
  // Phantom et Solflare sont toujours proposés (avec lien d'installation s'ils ne sont pas détectés, et ouverture dans l'appli sur mobile).
  // Les autres wallets compatibles « Wallet Standard » (Backpack, MetaMask…) sont détectés automatiquement.
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <I18nProvider>
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>
          <SessionProvider>{children}</SessionProvider>
          {walletErr && <WalletErrorBanner text={walletErr} close={() => setWalletErr(null)} />}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
    </I18nProvider>
  );
}
