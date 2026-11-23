"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { clearLocalKeypair, loadLocalKeypair, parseSecret, saveLocalKeypair, secretToJson, secretToString } from "@/lib/localWallet";
import { WALK_MINT } from "@/lib/token";
import { useSession } from "./SessionProvider";

const btn = "h-9 rounded-full border border-white/30 px-4 text-sm text-slate-100 transition hover:border-neon";

/** Mon wallet : adresse à copier, soldes SOL / $WALK on-chain, et (si la clé est dans ce navigateur) sauvegarde de la clé. */
export function WalletCard() {
  const { me } = useSession();
  const { connection } = useConnection();
  const { t } = useI18n();
  const [sol, setSol] = useState<number | null>(null);
  const [walk, setWalk] = useState<number | null>(null);
  const [fail, setFail] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [show, setShow] = useState(false);
  const [imp, setImp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [asking, setAsking] = useState(false);
  const wallet = me?.wallet;

  const load = useCallback(async () => {
    if (!wallet) return;
    setFail(false);
    try {
      const owner = new PublicKey(wallet);
      setSol((await connection.getBalance(owner)) / 1e9);
      if (WALK_MINT) {
        const r = await connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(WALK_MINT) });
        setWalk(r.value.reduce((a, x) => a + (Number(x.account.data.parsed?.info?.tokenAmount?.uiAmount) || 0), 0));
      }
    } catch { setFail(true); }
  }, [wallet, connection]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const k = loadLocalKeypair(); setHasKey(!!k && k.publicKey.toBase58() === wallet); }, [wallet]);

  if (!me || !wallet) return null;
  const copy = async (what: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); if (what === "key") setSaved(true); window.setTimeout(() => setCopied(null), 1500); } catch { /* ignoré */ } };
  const fmt = (n: number | null, d: number) => (n === null ? "…" : n.toLocaleString(undefined, { maximumFractionDigits: d }));
  const kp = hasKey ? loadLocalKeypair() : null;

  function download() {
    if (!kp) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([secretToJson(kp)], { type: "application/json" }));
    a.download = `neon-soles-key-${wallet!.slice(0, 6)}.json`; a.click(); URL.revokeObjectURL(a.href);
    setSaved(true);
  }
  function doDelete() { clearLocalKeypair(); setHasKey(false); setShow(false); setAsking(false); setSaved(false); setMsg(t("wb.deleted")); }
  function doImport() {
    try {
      const k = parseSecret(imp);
      if (k.publicKey.toBase58() !== wallet) { setMsg(t("em.importWrong")); return; }
      saveLocalKeypair(k); setHasKey(true); setImp(""); setMsg(t("wb.imported"));
    } catch { setMsg(t("em.importBad")); }
  }

  return (
    <section className="glass space-y-3 p-5" aria-label={t("wb.title")}>
      <h2 className="font-display text-lg text-white">{t("wb.title")}</h2>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-slate-300">SOL</p><p className="font-display text-xl text-white">{fmt(sol, 4)}</p></div>
        <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-slate-300">$WALK</p><p className="font-display text-xl text-neon">{fmt(walk, 2)}</p></div>
      </div>
      {fail && <p className="text-xs text-amber-200">{t("wb.fail")}</p>}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-[#0E1428] p-2">
        <span className="min-w-0 flex-1 break-all px-2 font-mono text-xs text-neon">{wallet}</span>
        <button onClick={() => void copy("addr", wallet)} className={btn}>{copied === "addr" ? t("land.copied") : t("wb.copyAddr")}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void load()} className={btn}>↻ {t("wb.refresh")}</button>
        <a href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noopener noreferrer" className={`${btn} inline-flex items-center`}>Solscan ↗</a>
      </div>
      <p className="text-xs text-slate-300">{t("wb.help")}</p>

      <details className="rounded-xl border border-white/10 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-100">{t("wb.keyTitle")}</summary>
        <div className="mt-3 space-y-2">
          {kp ? (
            <>
              <p className="text-xs text-slate-300">{t("wb.keyHere")}</p>
              {show && <p className="break-all rounded-lg bg-[#0E1428] p-2 font-mono text-xs text-neon select-all">{secretToString(kp)}</p>}
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => setShow((v) => !v)}>{show ? t("em.hide") : t("em.reveal")}</button>
                <button className={btn} onClick={() => void copy("key", secretToString(kp))}>{copied === "key" ? t("land.copied") : t("em.copy")}</button>
                <button className={btn} onClick={download}>{t("em.download")}</button>
              </div>
              {!asking ? (
                <>
                  <button className={`${btn} border-pink-400/60 text-pink-200 disabled:opacity-40`} disabled={!saved} onClick={() => setAsking(true)}>{t("wb.delBtn")}</button>
                  {!saved && <p className="text-xs text-slate-400">{t("wb.delLocked")}</p>}
                </>
              ) : (
                <div role="alertdialog" className="space-y-2 rounded-lg border border-pink-400/40 bg-pink-500/10 p-3">
                  <p className="text-xs text-pink-100">{t("wb.delWarn")}</p>
                  <div className="flex gap-2">
                    <button className={`${btn} border-pink-400 text-pink-100`} onClick={doDelete}>{t("wb.delYes")}</button>
                    <button className={btn} onClick={() => setAsking(false)}>{t("wb.delNo")}</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-slate-300">{t("wb.keyNone")}</p>
              <textarea className="h-20 w-full rounded-xl border border-white/20 bg-[#0E1428] p-2 font-mono text-xs text-white" placeholder={t("em.importPh")} value={imp} onChange={(e) => setImp(e.target.value)} />
              <button className={btn} disabled={!imp.trim()} onClick={doImport}>{t("em.importBtn")}</button>
            </>
          )}
          {msg && <p role="status" className="text-xs text-legend">{msg}</p>}
        </div>
      </details>
    </section>
  );
}

/** Petite pastille : copie l'adresse du wallet en un clic (accueil). */
export function CopyAddress({ wallet }: { wallet: string }) {
  const { t } = useI18n();
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
      <span className="font-mono">{wallet.slice(0, 4)}…{wallet.slice(-4)}</span>
      <button onClick={async () => { try { await navigator.clipboard.writeText(wallet); setOk(true); window.setTimeout(() => setOk(false), 1500); } catch { /* ignoré */ } }}
        className="rounded-full border border-white/30 px-3 py-1 text-slate-100 hover:border-neon">{ok ? t("land.copied") : t("wb.copyAddr")}</button>
      <a href="/profile" className="text-neon underline underline-offset-4">{t("wb.title")}</a>
    </div>
  );
}
