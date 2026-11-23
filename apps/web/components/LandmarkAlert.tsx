"use client";

import { useEffect, useRef, useState } from "react";
import { loadLandmark, type LandmarkInfo } from "@/lib/landmarks";
import type { Geo, NearLandmark } from "@/lib/nearby";
import { useI18n } from "@/lib/i18n";

const TRIGGER_M = 90;
const seen = new Set<string>(); // monuments déjà signalés (une seule alerte par monument tant que la page reste ouverte)

function distM(a: Geo, b: Geo) {
  return Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));
}

/**
 * Alerte discrète quand le joueur passe près d'un monument connu : nom + choix de lire ou non une courte description (Wikipédia).
 * Elle ne bloque rien, ne fait aucun bruit et se referme toute seule.
 */
export function LandmarkAlert({ cur, landmarks }: { cur: Geo | undefined; landmarks: NearLandmark[] }) {
  const { t, locale } = useI18n();
  const [alert, setAlert] = useState<NearLandmark | null>(null);
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<LandmarkInfo | null | "loading">(null);
  const timer = useRef(0);

  useEffect(() => {
    if (!cur || alert) return;
    const hit = landmarks.find((l) => !seen.has(l.wiki) && l.pts.some((p) => distM(p, cur) <= TRIGGER_M));
    if (!hit) return;
    seen.add(hit.wiki);
    setAlert(hit); setOpen(false); setInfo(null);
    timer.current = window.setTimeout(() => setAlert((a) => (a === hit && !open ? null : a)), 25_000);
  }, [cur?.lat, cur?.lng, landmarks, alert]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!alert) return null;
  const close = () => { window.clearTimeout(timer.current); setAlert(null); setOpen(false); setInfo(null); };
  const read = async () => {
    window.clearTimeout(timer.current);
    setOpen(true); setInfo("loading");
    setInfo(await loadLandmark(alert.wiki, locale));
  };

  return (
    <div role="status" className="nw-rise mx-auto mt-3 w-full max-w-[320px] rounded-2xl border border-amber-300/50 bg-amber-300/10 p-3 text-left shadow-[0_0_18px_-6px_#FCD34D]">
      <p className="text-xs text-amber-200">🏛️ {t("lm.near")}</p>
      <p className="font-display text-base text-white">{alert.name}</p>
      {!open ? (
        <div className="mt-2 flex gap-2">
          <button onClick={() => void read()} className="min-h-10 flex-1 rounded-full bg-amber-300 px-3 text-sm font-semibold text-night">{t("lm.more")}</button>
          <button onClick={close} className="min-h-10 rounded-full border border-white/25 px-4 text-sm text-slate-200">{t("lm.skip")}</button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {info === "loading" && <p className="text-sm text-slate-300">{t("lm.loading")}</p>}
          {info === null && <p className="text-sm text-slate-300">{t("lm.none")}</p>}
          {info && info !== "loading" && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {info.image && <img src={info.image} alt="" loading="lazy" className="h-28 w-full rounded-xl object-cover" />}
              <p className="text-sm leading-snug text-slate-100">{info.text}</p>
              <p className="text-[10px] text-slate-400">{t("lm.credit")}{info.url && <> · <a href={info.url} target="_blank" rel="noopener noreferrer" className="underline">Wikipedia</a></>}</p>
            </>
          )}
          <button onClick={close} className="min-h-10 w-full rounded-full border border-white/25 text-sm text-slate-200">{t("lm.close")}</button>
        </div>
      )}
    </div>
  );
}
