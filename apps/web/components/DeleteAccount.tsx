"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "./SessionProvider";

type Challenge = { method: "email"; email_hint: string } | { method: "wallet"; nonce: string; issued_at: string; message: string };
const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

/** Suppression de compte en 3 validations : 1) avertissement + case, 2) taper DELETE, 3) preuve d'identité (code email ou signature du wallet). */
export function DeleteAccount() {
  const { t, msg } = useI18n();
  const { refresh } = useSession();
  const { signMessage } = useWallet();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [ok, setOk] = useState(false);
  const [word, setWord] = useState("");
  const [ch, setCh] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fail = (e: unknown) => { setErr(e instanceof ApiError ? msg(e.message, e.code, e.params) : t("em.err")); setBusy(false); };
  const cancel = () => { setStep(0); setOk(false); setWord(""); setCh(null); setCode(""); setErr(null); };

  async function start() {
    setBusy(true); setErr(null);
    try { setCh(await api<Challenge>("/account/delete/start", { body: { confirm: "DELETE" } })); setStep(3); setBusy(false); } catch (e) { fail(e); }
  }
  async function confirm() {
    if (!ch) return;
    setBusy(true); setErr(null);
    try {
      if (ch.method === "email") await api("/account/delete/confirm", { body: { code } });
      else {
        if (!signMessage) { setErr(t("del.needWallet")); setBusy(false); return; }
        const signature = toBase64(await signMessage(new TextEncoder().encode(ch.message)));
        await api("/account/delete/confirm", { body: { nonce: ch.nonce, issued_at: ch.issued_at, signature } });
      }
      await refresh();
      window.location.href = "/";
    } catch (e) { fail(e); }
  }

  const danger = "h-11 rounded-full bg-red-500 px-6 font-display font-bold text-white disabled:opacity-50";
  return (
    <section className="space-y-3 rounded-2xl border border-red-400/40 bg-red-500/5 p-5" aria-label={t("del.title")}>
      <h2 className="font-display text-lg text-red-200">{t("del.title")}</h2>
      {step === 0 && (
        <>
          <p className="text-sm text-slate-300">{t("del.intro")}</p>
          <button onClick={() => setStep(1)} className="h-10 rounded-full border border-red-400/60 px-5 text-sm text-red-200 hover:bg-red-500/10">{t("del.start")}</button>
        </>
      )}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t("del.step", { n: 1 })}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            <li>{t("del.w1")}</li><li>{t("del.w2")}</li><li>{t("del.w3")}</li><li>{t("del.w4")}</li>
          </ul>
          <label className="flex items-start gap-2 text-sm text-slate-100">
            <input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span>{t("del.understand")}</span>
          </label>
          <div className="flex gap-2"><button className={danger} disabled={!ok} onClick={() => setStep(2)}>{t("del.next")}</button><button onClick={cancel} className="h-11 rounded-full border border-white/30 px-5 text-sm text-slate-100">{t("del.cancel")}</button></div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t("del.step", { n: 2 })}</p>
          <p className="text-sm text-slate-200">{t("del.typeIt")}</p>
          <input className="h-11 w-full rounded-xl border border-white/20 bg-[#0E1428] px-3 font-mono text-white outline-none focus:border-red-400" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" placeholder="DELETE" />
          <div className="flex gap-2"><button className={danger} disabled={word !== "DELETE" || busy} onClick={() => void start()}>{busy ? t("em.wait") : t("del.next")}</button><button onClick={cancel} className="h-11 rounded-full border border-white/30 px-5 text-sm text-slate-100">{t("del.cancel")}</button></div>
        </div>
      )}
      {step === 3 && ch && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t("del.step", { n: 3 })}</p>
          {ch.method === "email" ? (
            <>
              <p className="text-sm text-slate-200">{t("del.codeSent", { email: ch.email_hint })}</p>
              <input className="h-11 w-full rounded-xl border border-white/20 bg-[#0E1428] px-3 text-center font-mono text-2xl tracking-[.4em] text-white outline-none focus:border-red-400" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" />
            </>
          ) : <p className="text-sm text-slate-200">{t("del.signIt")}</p>}
          <div className="flex gap-2">
            <button className={danger} disabled={busy || (ch.method === "email" && code.length !== 6)} onClick={() => void confirm()}>{busy ? t("em.wait") : t("del.final")}</button>
            <button onClick={cancel} className="h-11 rounded-full border border-white/30 px-5 text-sm text-slate-100">{t("del.cancel")}</button>
          </div>
        </div>
      )}
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
    </section>
  );
}
