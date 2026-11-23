"use client";

import { Badges } from "@/components/Badges";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Back } from "@/components/Back";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Res { week_start: string; week_end: string; top_n: number; min_km: number; top: { rank: number; pseudo: string | null; avatar: number | null; meters: number; me: boolean; badges?: string[] }[]; mine: { rank: number; meters: number } | null }

/** Classement de la semaine : par distance marchée (jamais par argent dépensé). */
export default function RankingPage() {
  const { t, num, locale } = useI18n();
  const [d, setD] = useState<Res | null>(null);
  useEffect(() => { api<Res>("/ranking").then(setD).catch(() => setD(null)); }, []);
  const km = (m: number) => (m / 1000).toLocaleString(locale, { maximumFractionDigits: 1 });
  const day = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short" });
  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8">
      <Back />
      <h1 className="font-display text-3xl text-white">{t("ranking.title")}</h1>
      <p className="text-sm text-slate-300">{t("ranking.sub", { n: d?.top_n ?? 10, km: d?.min_km ?? 3 })}</p>
      {d && <p className="text-xs text-slate-400">{t("ranking.week", { a: day(d.week_start), b: day(d.week_end) })}</p>}
      {d?.mine && <p className="glass p-3 text-center font-display text-neon">{t("ranking.you", { r: num(d.mine.rank), d: km(d.mine.meters) })}</p>}
      {d && d.top.length === 0 && <p className="text-sm text-slate-400">{t("ranking.empty")}</p>}
      <ol className="space-y-2">
        {d?.top.map((r) => (
          <li key={r.rank} className={`glass flex items-center gap-3 p-3 ${r.me ? "border-neon" : ""}`}>
            <span className={`w-8 text-center font-display text-lg ${r.rank <= (d?.top_n ?? 10) ? "text-legend" : "text-slate-400"}`}>{r.rank}</span>
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full">{r.avatar !== null && <Avatar face={r.avatar} />}</span>
            <span className="min-w-0 flex-1 truncate text-white">{r.pseudo ?? "—"} <Badges codes={r.badges} />{r.me && <span className="ml-2 text-xs text-neon">{t("ranking.meTag")}</span>}</span>
            <span className="font-display text-slate-100">{t("ranking.km", { d: km(r.meters) })}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
