"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BUY_URL, CHART_URL, SOLSCAN_URL, WALK_MINT } from "@/lib/token";
import { LanguageSwitcher } from "./LanguageSwitcher";

/** Bandeau du haut sur toutes les pages : adresse du contrat (copiable), bouton d'achat vert et langue. */
export function CaBar() {
  const { t, num, locale } = useI18n();
  const usd = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(n);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ registered: number; walkers24h: number } | null>(null);
  const [tok, setTok] = useState<{ available: boolean; market_cap?: number | null; change_24h?: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const loadTok = () => api<NonNullable<typeof tok>>("/token/stats").then((v) => { if (alive) setTok(v); }).catch(() => undefined);
    void loadTok();
    const tid = window.setInterval(loadTok, 60_000);
    const load = () => api<{ registered: number; walkers24h: number }>("/stats").then((v) => { if (alive) setStats(v); }).catch(() => undefined);
    void load();
    const id = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(id); window.clearInterval(tid); };
  }, []);

  async function copy() {
    try { await navigator.clipboard.writeText(WALK_MINT); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { /* presse-papiers indisponible : l'adresse reste sélectionnable */ }
  }

  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-night/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-3 py-2">
        <span className="font-display text-[11px] text-slate-400">CA</span>
        <a href={SOLSCAN_URL} target="_blank" rel="noopener noreferrer" title="Solscan"
          className="min-w-0 flex-1 truncate rounded-lg bg-[#0E1428] px-2 py-1.5 font-mono text-xs text-neon underline underline-offset-4 sm:flex-none sm:max-w-[26rem]">
          {WALK_MINT}
        </a>
        <button onClick={() => void copy()} aria-live="polite"
          className="h-9 rounded-full border border-white/30 px-4 text-sm text-slate-100 transition hover:border-neon hover:text-neon">
          {copied ? t("land.copied") : t("land.copy")}
        </button>
        <a href={BUY_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-full bg-neon px-5 font-display text-sm font-bold text-night shadow-neon transition hover:brightness-110">
          {t("land.buy")}
        </a>
        <div className="ml-auto"><LanguageSwitcher /></div>
      </div>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-3 pb-1.5 text-[11px]">
        {stats ? (
          <p className="text-slate-300" role="status">
            <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon align-middle" />
            {t("stats.line", { n: num(stats.registered), w: num(stats.walkers24h) })}
          </p>
        ) : <span />}
        {tok?.available && tok.market_cap != null && (
          <a href={CHART_URL} target="_blank" rel="noopener noreferrer" className="text-slate-200 hover:text-neon" title="GMGN">
            {t("token.mcap")} <span className="font-semibold text-neon">{usd(tok.market_cap)}</span>
            {tok.change_24h != null && <span className={`ml-1.5 ${tok.change_24h >= 0 ? "text-neon" : "text-red-300"}`}>{tok.change_24h >= 0 ? "▲" : "▼"} {Math.abs(tok.change_24h).toFixed(1)}%</span>}
          </a>
        )}
      </div>
    </div>
  );
}
