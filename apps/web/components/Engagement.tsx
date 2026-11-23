"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface QuestsRes { quests: { id: string; metric: string; target: number; value: number; done: boolean }[]; done: number; bonus_pct: number; per_quest_pct: number; boost_pct: number; boost_until: string | null }
interface RefRes { code: string | null; invited: number; max: number; boost_pct: number; boost_days: number; boost_until: string | null }

/** Accueil : quêtes du jour (avec leur bonus) et lien d'invitation. */
export function Engagement() {
  const { t, num, date } = useI18n();
  const [q, setQ] = useState<QuestsRes | null>(null);
  const [r, setR] = useState<RefRes | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api<QuestsRes>("/quests").then(setQ).catch(() => undefined);
    api<RefRes>("/referral").then(setR).catch(() => undefined);
  }, []);

  const label = (x: QuestsRes["quests"][number]) =>
    x.metric === "walks" ? t("quests.q.walks", { t: x.target }) : x.metric === "distance_m" ? t("quests.q.distance", { t: num(x.target) }) : t("quests.q.minutes", { t: Math.round(x.target / 60) });
  const valueText = (x: QuestsRes["quests"][number]) =>
    x.metric === "walks" ? `${Math.min(x.value, x.target)}/${x.target}` : x.metric === "distance_m" ? `${num(Math.min(x.value, x.target))}/${num(x.target)} m` : `${Math.min(Math.floor(x.value / 60), Math.round(x.target / 60))}/${Math.round(x.target / 60)} min`;
  const link = r?.code && typeof window !== "undefined" ? `${window.location.origin}/?ref=${r.code}` : "";
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* ignoré */ }
  }

  return (
    <>
      {q && q.quests.length > 0 && (
        <section className="glass space-y-3 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg text-white">{t("quests.title")}</h2>
            <span className="text-xs text-neon">{t("quests.bonus", { p: q.bonus_pct })}</span>
          </div>
          <p className="text-xs text-slate-400">{t("quests.sub", { p: q.per_quest_pct, max: q.per_quest_pct * q.quests.length })}</p>
          <ul className="space-y-2.5">
            {q.quests.map((x) => (
              <li key={x.id}>
                <div className="flex justify-between text-sm"><span className={x.done ? "text-neon" : "text-slate-200"}>{x.done ? "✓ " : ""}{label(x)}</span><span className="text-xs text-slate-400">{valueText(x)}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-neon transition-all" style={{ width: `${Math.min(100, (x.value / x.target) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {r?.code && (
        <section className="glass space-y-3 p-5">
          <h2 className="font-display text-lg text-white">{t("invite.title")}</h2>
          <p className="text-sm text-slate-300">{t("invite.p", { b: r.boost_pct, d: r.boost_days })}</p>
          {r.boost_until && <p className="text-xs text-neon">{t("invite.boost", { b: r.boost_pct, d: date(r.boost_until) })}</p>}
          <div className="flex gap-2">
            <input readOnly value={link} aria-label={t("invite.link")} onFocus={(e) => e.currentTarget.select()} className="h-11 min-w-0 flex-1 rounded-xl border border-white/25 bg-night px-3 text-xs text-white" />
            <button onClick={() => void copy()} className="min-h-11 rounded-full bg-neon px-5 text-sm font-semibold text-night">{copied ? t("invite.copied") : t("invite.copy")}</button>
          </div>
          <p className="text-xs text-slate-400">{t("invite.count", { n: r.invited, m: r.max })}</p>
        </section>
      )}
    </>
  );
}
