"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CHART_URL } from "@/lib/token";

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/**
 * Deux boutons flottants, présents sur toutes les pages et qui suivent l'écran :
 * - en bas à gauche : le graphique du jeton (lien GMGN) ;
 * - en bas à droite : « Installer l'application » (appli portable / PWA).
 */
export function FloatingActions() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); setHelp(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (evt) {
      await evt.prompt();
      await evt.userChoice.catch(() => undefined);
      setEvt(null);
    } else setHelp(true);
  }

  const pill = "pointer-events-auto flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-lg backdrop-blur";
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end justify-between gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <a href={CHART_URL} target="_blank" rel="noopener noreferrer" aria-label={t("chart.aria")} className={`${pill} border border-white/25 bg-night/90 text-white hover:border-neon`}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="#39FF88" strokeWidth="2" strokeLinecap="round">
            <path d="M6 4v3M6 15v3M12 7v2M12 17v3M18 3v4M18 13v5" /><rect x="4" y="7" width="4" height="8" rx="1" fill="#39FF88" /><rect x="10" y="9" width="4" height="8" rx="1" /><rect x="16" y="7" width="4" height="6" rx="1" fill="#39FF88" />
          </svg>
          <span>{t("chart.btn")}<span className="ml-1 text-xs font-normal text-slate-400">GMGN</span></span>
        </a>
        {!installed && (
          <button onClick={install} className={`${pill} bg-neon text-night hover:brightness-110`}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 20h14" /></svg>
            {t("install.btn")}
          </button>
        )}
      </div>

      {help && (
        <div role="dialog" aria-modal="true" aria-label={t("install.btn")} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setHelp(false)}>
          <div className="glass w-full max-w-sm space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg text-white">{t("install.title")}</h2>
            <p className="text-sm text-slate-200">{ios ? t("install.ios") : t("install.other")}</p>
            <button onClick={() => setHelp(false)} className="min-h-11 w-full rounded-full bg-neon px-5 text-sm font-semibold text-night">{t("install.close")}</button>
          </div>
        </div>
      )}
    </>
  );
}
