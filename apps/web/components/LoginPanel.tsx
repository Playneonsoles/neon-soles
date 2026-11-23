"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState } from "react";
import { visualTierForLevel } from "@walk/game";
import { Avatar } from "./Avatar";
import { useI18n } from "@/lib/i18n";
import { BUY_URL, WALK_MINT } from "@/lib/token";
import { useSession } from "./SessionProvider";
import { EmailLogin } from "./EmailLogin";
import { ShoeSprite } from "./ShoeSprite";
import { WalkerLane } from "./WalkerLane";

export function LoginPanel() {
  const { connected, publicKey, connecting } = useWallet();
  const { signIn, error } = useSession();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);
  const asked = useRef<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)); }, []);

  async function sign() {
    setBusy(true);
    try { await signIn(); } finally { setBusy(false); }
  }

  // Dès que le wallet est connecté (y compris au retour de l'appli Phantom), on demande la signature une seule fois.
  useEffect(() => {
    const key = publicKey?.toBase58() ?? null;
    if (connected && key && asked.current !== key) { asked.current = key; void sign(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey]);

  const short = publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : null;
  const phantomLink = typeof window === "undefined" ? "#"
    : `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=${encodeURIComponent(window.location.origin)}`;

  const steps = [[t("login.s1t"), t("login.s1d")], [t("login.s2t"), t("login.s2d")], [t("login.s3t"), t("login.s3d")]];
  const rarities = [
    { k: "common", c: "#CBD5E1", m: 1, lv: 4 }, { k: "rare", c: "#3B82F6", m: 1.2, lv: 8 }, { k: "epic", c: "#A855F7", m: 1.44, lv: 12 },
    { k: "legendary", c: "#F59E0B", m: 1.87, lv: 16 }, { k: "mythic", c: "#F43F5E", m: 2.43, lv: 20 },
  ] as const;
  const features = [
    ["craft", false], ["market", false], ["quests", false], ["streaks", false], ["ranking", false], ["invite", false], ["char", false], ["install", false],
  ] as const;
  const faqs = [1, 2, 3, 4, 5, 6, 7] as const;
  const MINT = WALK_MINT;
  const BUY = BUY_URL;
  const [h1a, h1b] = t("land.h1").split("|");

  const wallet = (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className={connected ? "" : "nw-cta rounded-full"}>
          <WalletMultiButton>{connected ? t("login.change") : t("login.choose")}</WalletMultiButton>
        </div>
        {!connected && <EmailLogin />}
      </div>
      {connecting && <p className="text-sm text-slate-300">{t("login.connecting")}</p>}
      {connected && (
        <>
          <p className="text-sm text-slate-300">{t("login.connected")} <span className="font-mono text-white">{short}</span></p>
          <button onClick={sign} disabled={busy}
            className="h-[52px] rounded-full border border-neon px-7 font-display font-bold text-neon transition hover:bg-neon/10 disabled:opacity-60">
            {busy ? t("login.waiting") : t("login.sign")}
          </button>
          <p className="text-xs text-slate-400">{t("login.signHint")}</p>
        </>
      )}
      {mobile && !connected && (
        <a href={phantomLink} className="text-sm text-neon underline underline-offset-4">{t("login.phantom")}</a>
      )}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );

  async function copy() {
    try { await navigator.clipboard.writeText(MINT); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* ignoré */ }
  }
  const h2 = "font-display text-2xl font-bold text-white";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-12 py-6">
      <section className="glass nw-rise p-8 text-center shadow-neon" style={{ background: "radial-gradient(600px 260px at 50% 0,rgba(57,255,136,.16),transparent 70%),rgba(255,255,255,.05)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="mb-3 grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="order-2 sm:order-1 sm:justify-self-end"><a href="/rules" className="block rounded-full border border-neon/60 bg-night/60 px-5 py-2.5 text-center text-sm text-neon backdrop-blur transition hover:bg-neon/10">{t("rules.link")}</a></div>
          <div className="order-1 col-span-2 sm:order-2 sm:col-span-1">
        <div className="sx-float mx-auto w-64 max-w-[80%]" role="img" aria-label="Neon Soles">
          <ShoeSprite level={20} walking visual={{ color: "#F43F5E", effects: ["glow", "sparkles", "aura", "trail", "lightning", "wings", "halo"], tier: "mythic" }} />
        </div>
          </div>
          <div className="order-3 sm:justify-self-start"><a href="/ideas" className="block rounded-full border border-neon/60 bg-night/60 px-5 py-2.5 text-center text-sm text-neon backdrop-blur transition hover:bg-neon/10">{t("ideas.link")}</a></div>
        </div>
        <p className="font-display text-xs tracking-[.12em] text-neon">{t("login.eyebrow")}</p>
        <h1 className="mx-auto mt-2 font-display text-4xl font-black leading-tight text-white sm:text-5xl">{h1a}<br />{h1b}</h1>
        <div className="mx-auto mt-5 w-full max-w-md"><WalkerLane /></div>
        <p className="mx-auto mt-3 max-w-xl text-slate-200">{t("land.lead")}</p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {wallet}
          {BUY && <a href={BUY} target="_blank" rel="noopener noreferrer" className="inline-flex h-[52px] items-center rounded-full border border-white/40 px-7 font-display font-bold text-slate-100 transition hover:border-neon hover:text-neon">{t("land.buy")}</a>}
        </div>
        <p className="mt-4 text-sm text-slate-300">{t("land.note")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Avatar key={i} face={i} className="block w-[52px]" />)}
        </div>
        <p className="mt-6 rounded-xl border border-legend/40 bg-legend/10 p-3 text-sm text-legend">{t("login.legal")}</p>
      </section>

      <section className="space-y-4">
        <h2 className={`${h2} text-center`}>{t("land.how")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map(([title, d], i) => (
            <div key={title} className="glass nw-card nw-rise p-4 text-left" style={{ animationDelay: `${0.12 * (i + 1)}s` }}>
              <b className="font-display text-neon">{title}</b>
              <p className="mt-2 text-sm text-slate-300">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-center">
          <h2 className={h2}>{t("land.rar.title")}</h2>
          <p className="mt-1 text-sm text-slate-300">{t("land.rar.sub")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {rarities.map((r) => {
            const tier = visualTierForLevel(r.lv);
            return (
              <div key={r.k} className="nw-card rounded-2xl bg-white/5 p-3 text-center" style={{ border: `2px solid ${r.c}`, boxShadow: `0 0 ${6 + r.lv}px ${r.c}55` }}>
                <ShoeSprite level={r.lv} visual={{ color: r.c, effects: tier.effects }} className="mx-auto w-full" />
                <p className="font-display text-sm" style={{ color: r.c }}>{t(`rar.${r.k}` as "rar.common")}</p>
                <p className="font-display text-lg text-white">×{r.m.toFixed(2)}</p>
                <p className="text-[11px] text-slate-400">{t("land.rar.mult", { m: r.m.toFixed(2) })}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={`${h2} text-center`}>{t("land.feat.title")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(([k, soon]) => (
            <div key={k} className="glass nw-card p-4 text-left">
              <div className="flex items-center justify-between gap-2">
                <b className="font-display text-sm text-white">{t(`feat.${k}.t` as "feat.craft.t")}</b>
                {soon && <span className="rounded-full border border-legend/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-legend">{t("land.soon")}</span>}
              </div>
              <p className="mt-2 text-sm text-slate-300">{t(`feat.${k}.d` as "feat.craft.d")}</p>
            </div>
          ))}
        </div>
      </section>

      <nav className="flex flex-wrap items-center justify-center gap-3 text-sm" aria-label="Info">
        <a href="/rules" className="rounded-full border border-white/25 px-5 py-2.5 text-slate-100 hover:border-neon">{t("rules.link")}</a>
        <a href="/ideas" className="rounded-full border border-white/25 px-5 py-2.5 text-slate-100 hover:border-neon">{t("ideas.link")}</a>
        <a href="/privacy" className="rounded-full border border-white/25 px-5 py-2.5 text-slate-100 hover:border-neon">{t("priv.link")}</a>
      </nav>

      <section className="glass space-y-2 p-6" style={{ borderColor: "rgba(57,255,136,.4)" }}>
        <h2 className="font-display text-xl text-white">{t("land.keys.t")}</h2>
        <p className="text-sm text-slate-300">{t("land.keys.d")}</p>
      </section>

      {MINT && (
        <section className="glass space-y-3 p-6 text-center">
          <h2 className="font-display text-xl text-white">{t("land.token.t")}</h2>
          <p className="text-sm text-slate-300">{t("land.token.d")}</p>
          <div className="mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-white/5 p-2">
            <span className="px-2 font-display text-[11px] text-slate-400">CA</span>
            <a className="min-w-0 flex-1 truncate rounded-lg bg-[#0E1428] px-2 py-1.5 font-mono text-xs text-neon underline underline-offset-4" href={`https://solscan.io/token/${MINT}`} target="_blank" rel="noopener noreferrer">{MINT}</a>
            <button onClick={() => void copy()} className="h-9 rounded-full border border-white/30 px-4 text-sm text-slate-100 hover:border-neon">{copied ? t("land.copied") : t("land.copy")}</button>
            {BUY && <a href={BUY} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-full bg-neon px-4 font-display text-sm font-bold text-night">{t("land.buy")}</a>}
          </div>
        </section>
      )}

      <section className="glass p-6">
        <h2 className="mb-2 font-display text-xl text-white">{t("faq.title")}</h2>
        {faqs.map((n) => (
          <details key={n} className="border-t border-white/10 py-3">
            <summary className="cursor-pointer font-semibold text-slate-100">{t(`faq.${n}q` as "faq.1q")}</summary>
            <p className="mt-2 text-sm text-slate-300">{t(`faq.${n}a` as "faq.1a")}</p>
          </details>
        ))}
      </section>

      <section className="glass nw-rise space-y-4 p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-white">{t("land.cta.t")}</h2>
        {wallet}
        <p className="text-sm text-slate-300">{t("land.cta.d")}</p>
      </section>
    </div>
  );
}
