"use client";

import type { Keypair } from "@solana/web3.js";
import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { loadLocalKeypair, newLocalKeypair, parseSecret, saveLocalKeypair, secretToJson, secretToString } from "@/lib/localWallet";
import { getTurnstileToken } from "@/lib/turnstile";
import { useSession } from "./SessionProvider";

type Methods = { email: boolean; google: string | null };
type Step = "form" | "backup" | "code" | "import";
type Next = { kind: "email" } | { kind: "google"; credential: string };

declare global {
  interface Window { google?: { accounts: { id: { initialize: (o: object) => void; renderButton: (el: HTMLElement, o: object) => void } } } }
}

const inp = "h-11 w-full rounded-xl border border-white/20 bg-[#0E1428] px-3 text-white outline-none focus:border-neon";
const btn = "h-11 rounded-full bg-neon px-6 font-display font-bold text-night disabled:opacity-60";

/** Connexion sans wallet : email (code reçu par mail) ou Google. Un wallet est créé dans le navigateur du joueur. */
export function EmailLogin() {
  const { t, msg } = useI18n();
  const { refresh } = useSession();
  const [methods, setMethods] = useState<Methods | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [step, setStep] = useState<Step>("form");
  const [f, setF] = useState({ first: "", last: "", email: "", consent: false, website: "" });
  const [code, setCode] = useState("");
  const [kp, setKp] = useState<Keypair | null>(null);
  const [next, setNext] = useState<Next>({ kind: "email" });
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [imp, setImp] = useState("");
  const gbtn = useRef<HTMLDivElement>(null);
  const nextRef = useRef(next); nextRef.current = next;

  useEffect(() => { api<Methods>("/auth/methods").then(setMethods).catch(() => setMethods(null)); }, []);

  const fail = (e: unknown) => { setErr(e instanceof ApiError ? msg(e.message, e.code, e.params) : t("em.err")); setBusy(false); };

  async function finish() {
    try {
      const ref = localStorage.getItem("ns_ref");
      if (ref) { localStorage.removeItem("ns_ref"); await api("/referral/claim", { body: { code: ref } }).catch(() => undefined); }
    } catch { /* ignoré */ }
    await refresh();
  }
  const display = () => (window.matchMedia("(display-mode: standalone)").matches ? "app" : "browser");

  async function googleCb(resp: { credential: string }) {
    setErr(null); setBusy(true);
    try {
      const r = await api<{ ok?: boolean; is_new?: boolean; need_wallet?: boolean }>("/auth/google", { body: { credential: resp.credential, display_mode: display() } });
      if (r.need_wallet) { setKp(newLocalKeypair()); setNext({ kind: "google", credential: resp.credential }); setMode("signup"); setStep("backup"); setOpen(true); setBusy(false); return; }
      if (!loadLocalKeypair()) { setStep("import"); setBusy(false); setOpen(true); return; }
      await finish();
    } catch (e) { fail(e); }
  }

  useEffect(() => {
    if (!methods?.google || !open) return;
    const init = () => {
      if (!window.google || !gbtn.current) return;
      window.google.accounts.id.initialize({ client_id: methods.google, callback: (r: { credential: string }) => void googleCb(r) });
      gbtn.current.innerHTML = "";
      window.google.accounts.id.renderButton(gbtn.current, { theme: "filled_black", size: "large", shape: "pill", width: 280, text: "continue_with" });
    };
    if (window.google) { init(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = init;
    document.head.appendChild(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods, open]);

  const off = !methods || (!methods.email && !methods.google); // clés d'envoi pas encore configurées : boutons visibles, mais « bientôt »

  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (mode === "signup") {
      if (!f.consent) { setErr(t("em.needConsent")); return; }
      setKp(newLocalKeypair()); setNext({ kind: "email" }); setSaved(false); setReveal(false); setStep("backup");
      return;
    }
    await sendCode();
  }

  async function sendCode(wallet?: string) {
    setBusy(true); setErr(null);
    try {
      await api("/auth/email/start", { body: {
        email: f.email, ...(mode === "signup" ? { first_name: f.first, last_name: f.last, wallet, consent: true } : {}), website: f.website, turnstile_token: await getTurnstileToken(),
      } });
      setStep("code"); setBusy(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "no_account") { setMode("signup"); setStep("form"); }
      fail(e);
    }
  }

  async function afterBackup() {
    if (!kp) return;
    saveLocalKeypair(kp); // la clé est gardée dans ce navigateur pour signer les achats
    if (next.kind === "email") { await sendCode(kp.publicKey.toBase58()); return; }
    setBusy(true); setErr(null);
    try {
      await api("/auth/google", { body: { credential: next.credential, wallet: kp.publicKey.toBase58(), display_mode: display() } });
      await finish();
    } catch (e) { fail(e); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api("/auth/email/verify", { body: { email: f.email, code, display_mode: display() } });
      if (mode === "login" && !loadLocalKeypair()) { setStep("import"); setBusy(false); return; }
      await finish();
    } catch (e2) { fail(e2); }
  }

  async function doImport() {
    setErr(null);
    try {
      const k = parseSecret(imp);
      const me = await api<{ wallet: string }>("/me");
      if (k.publicKey.toBase58() !== me.wallet) { setErr(t("em.importWrong")); return; }
      saveLocalKeypair(k); await finish();
    } catch { setErr(t("em.importBad")); }
  }

  function download() {
    if (!kp) return;
    const blob = new Blob([secretToJson(kp)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `neon-soles-key-${kp.publicKey.toBase58().slice(0, 6)}.json`; a.click();
    URL.revokeObjectURL(a.href);
  }
  const copy = async () => { if (kp) try { await navigator.clipboard.writeText(secretToString(kp)); } catch { /* ignoré */ } };

  if (!open) {
    return (
      <>
        <button onClick={() => { setMode("login"); setStep("form"); setErr(null); setOpen(true); }} className="h-[52px] rounded-full border border-neon px-7 font-display font-bold text-neon transition hover:bg-neon/10">{t("em.loginBtn")}</button>
        <button onClick={() => { setMode("signup"); setStep("form"); setErr(null); setOpen(true); }} className="h-[52px] rounded-full bg-neon px-7 font-display font-bold text-night shadow-neon">{t("em.signup")}</button>
      </>
    );
  }

  return (
    <div className="glass mx-auto w-full max-w-md basis-full space-y-4 p-5 text-left" style={{ borderColor: "rgba(57,255,136,.4)" }}>
      <div className="flex items-center justify-between">
        <b className="font-display text-white">{t(mode === "signup" ? "em.signup" : "em.loginBtn")}</b>
        <button onClick={() => { setOpen(false); setStep("form"); setErr(null); }} className="text-sm text-slate-400 hover:text-white" aria-label="close">✕</button>
      </div>

      {off && <p className="rounded-xl border border-legend/40 bg-legend/10 p-3 text-center text-sm text-legend">{t("em.soon")}</p>}

      {!off && step === "form" && (
        <>
          {mode === "signup" ? (
            <div className="rounded-xl border border-neon/40 bg-neon/10 p-3 text-center">
              <p className="font-display text-lg font-bold text-neon">{t("em.welcomeT")}</p>
              <p className="mt-1 text-sm text-slate-200">{t("em.welcomeD")}</p>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-200">{t("em.loginInfo")}</p>
          )}
          {methods?.email && (
            <form onSubmit={(e) => void submitForm(e)} className="relative space-y-3 overflow-hidden">
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-2">
                  <input className={inp} required maxLength={60} autoComplete="given-name" placeholder={t("em.first")} value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} />
                  <input className={inp} required maxLength={60} autoComplete="family-name" placeholder={t("em.last")} value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} />
                </div>
              )}
              <input className={inp} type="email" required maxLength={254} autoComplete="email" placeholder={t("em.email")} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
              {mode === "signup" && (
                <label className="flex items-start gap-2 text-xs text-slate-300">
                  <input type="checkbox" className="mt-0.5" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
                  <span>{t("em.consent")} <a href="/privacy" target="_blank" className="text-neon underline underline-offset-4">{t("priv.link")}</a></span>
                </label>
              )}
              <button className={`${btn} w-full`} disabled={busy}>{busy ? t("em.wait") : t(mode === "signup" ? "em.create" : "em.sendCode")}</button>
              <p className="text-xs text-slate-400">{t("em.captcha")}</p>
            </form>
          )}
          {methods?.google && (
            <div className="space-y-2 text-center">
              {methods?.email && <p className="text-xs text-slate-400">{t("em.or")}</p>}
              <div ref={gbtn} className="flex justify-center" />
            </div>
          )}
          <p className="text-center text-sm text-slate-300">
            {mode === "signup" ? t("em.haveAcc") : t("em.noAcc")}{" "}
            <button type="button" className="text-neon underline underline-offset-4" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(null); }}>{mode === "signup" ? t("em.loginBtn") : t("em.signup")}</button>
          </p>
        </>
      )}

      {step === "backup" && kp && (
        <div className="space-y-3">
          <p className="rounded-xl border border-legend/40 bg-legend/10 p-3 text-sm text-legend">{t("em.backupWarn")}</p>
          <p className="text-xs text-slate-300">{t("em.address")}: <span className="break-all font-mono text-white">{kp.publicKey.toBase58()}</span></p>
          <div className="rounded-xl bg-[#0E1428] p-3 font-mono text-xs text-neon break-all select-all">
            {reveal ? secretToString(kp) : "•••• •••• •••• •••• •••• •••• ••••"}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" onClick={() => setReveal((v) => !v)} className="h-9 rounded-full border border-white/30 px-4 text-slate-100 hover:border-neon">{reveal ? t("em.hide") : t("em.reveal")}</button>
            <button type="button" onClick={() => void copy()} className="h-9 rounded-full border border-white/30 px-4 text-slate-100 hover:border-neon">{t("em.copy")}</button>
            <button type="button" onClick={download} className="h-9 rounded-full border border-white/30 px-4 text-slate-100 hover:border-neon">{t("em.download")}</button>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-200">
            <input type="checkbox" className="mt-1" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            <span>{t("em.saved")}</span>
          </label>
          <button className={`${btn} w-full`} disabled={!saved || busy} onClick={() => void afterBackup()}>{busy ? t("em.wait") : t("em.continue")}</button>
        </div>
      )}

      {step === "code" && (
        <form onSubmit={(e) => void verify(e)} className="space-y-3">
          <p className="text-sm text-slate-200">{t("em.codeSent", { email: f.email })}</p>
          <input className={`${inp} text-center font-mono text-2xl tracking-[.4em]`} inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className={`${btn} w-full`} disabled={busy || code.length !== 6}>{busy ? t("em.wait") : t("em.verify")}</button>
        </form>
      )}

      {step === "import" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-200">{t("em.importInfo")}</p>
          <textarea className={`${inp} h-24 py-2 font-mono text-xs`} placeholder={t("em.importPh")} value={imp} onChange={(e) => setImp(e.target.value)} />
          <div className="flex gap-2">
            <button className={btn} disabled={!imp.trim()} onClick={() => void doImport()}>{t("em.importBtn")}</button>
            <button className="h-11 rounded-full border border-white/30 px-5 text-sm text-slate-100" onClick={() => void finish()}>{t("em.skip")}</button>
          </div>
        </div>
      )}

      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
    </div>
  );
}
