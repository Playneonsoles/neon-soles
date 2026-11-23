"use client";

import { getTurnstileToken } from "../lib/turnstile";
import { useWallet } from "@solana/wallet-adapter-react";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, type Me, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Ctx {
  me: Me | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}
const SessionCtx = createContext<Ctx | null>(null);
export const useSession = () => {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSession outside SessionProvider");
  return c;
};

const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

export function SessionProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, wallet, disconnect } = useWallet();
  const { t, msg } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Au chargement : la session (cookie) est-elle encore valide ? (la visite la prolonge de 7 jours)
  useEffect(() => {
    // Code d'invitation (?ref=CODE) : gardé jusqu'à la connexion.
    try { const r = new URLSearchParams(window.location.search).get("ref"); if (r && /^[A-Za-z0-9]{6,12}$/.test(r)) localStorage.setItem("ns_ref", r.toUpperCase()); } catch { /* ignoré */ }
    api<Me>("/me").then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    if (!publicKey || !signMessage) {
      setError(t("login.noSign"));
      return;
    }
    try {
      const address = publicKey.toBase58();
      // 1) nonce unique (5 min)  2) signature du message dans le wallet  3) vérification serveur
      const n = await api<{ nonce: string; issued_at: string; message: string }>("/auth/nonce", { body: { wallet: address, turnstile_token: await getTurnstileToken() } });
      const signature = toBase64(await signMessage(new TextEncoder().encode(n.message)));
      await api("/auth/verify", {
        body: { wallet: address, nonce: n.nonce, issued_at: n.issued_at, signature, wallet_kind: wallet?.adapter.name,
          display_mode: window.matchMedia("(display-mode: standalone)").matches ? "app" : "browser" },
      });
      try {
        const ref = localStorage.getItem("ns_ref");
        if (ref) { localStorage.removeItem("ns_ref"); await api("/referral/claim", { body: { code: ref } }).catch(() => undefined); }
      } catch { /* ignoré */ }
      setMe(await api<Me>("/me"));
    } catch (e) {
      if (e instanceof ApiError) { setError(msg(e.message, e.code, e.params)); return; }
      // Refus volontaire dans le wallet : message simple. Autre échec de signature : on montre la cause réelle pour pouvoir la corriger.
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      setError(/reject|cancel|denied|closed/i.test(detail) ? t("login.cancelled") : `${t("login.cancelled")} (${detail})`);
    }
  }, [publicKey, signMessage, wallet, t, msg]);

  const refresh = useCallback(async () => { setMe(await api<Me>("/me").catch(() => null)); }, []);

  const signOut = useCallback(async () => {
    await api("/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    setMe(null);
    await disconnect().catch(() => undefined);
  }, [disconnect]);

  return <SessionCtx.Provider value={{ me, loading, error, signIn, signOut, refresh }}>{children}</SessionCtx.Provider>;
}
