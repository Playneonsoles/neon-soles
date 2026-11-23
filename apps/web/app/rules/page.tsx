"use client";

import { useEffect, useState } from "react";
import { Back } from "@/components/Back";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Cfg = Record<string, unknown>;
const n = (c: Cfg, k: string, d = 0) => (typeof c[k] === "number" ? (c[k] as number) : d);
const RAR = [["common", "#CBD5E1"], ["rare", "#3B82F6"], ["epic", "#A855F7"], ["legendary", "#F59E0B"], ["mythic", "#F43F5E"]] as const;

/** Page « Règles et économie » : tous les chiffres viennent en direct de la configuration du jeu (jamais de valeur recopiée à la main). */
export default function RulesPage() {
  const { t, num, locale } = useI18n();
  const [c, setC] = useState<Cfg | null>(null);
  useEffect(() => { api<Cfg>("/config/public").then(setC).catch(() => setC({})); }, []);
  if (!c) return <main className="p-8 text-slate-300">{t("rules.loading")}</main>;

  const max = n(c, "max_level", 20), costBase = n(c, "cost_base", 20), growth = n(c, "cost_growth", 1.38), fac = n(c, "upgrade_minutes_factor", 10);
  const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`);
  const rows = Array.from({ length: Math.max(0, max - 1) }, (_, i) => ({ lv: i + 1, cost: Math.round(costBase * Math.pow(growth, i)), min: fac * (i + 1) * (i + 1) }));
  const mult = (c.rarity_multipliers ?? {}) as Record<string, number>;
  const until = typeof c.tester_shoes_until === "string" ? new Date(c.tester_shoes_until).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : "";
  const p: Record<string, Record<string, string | number>> = {
    s1: { h: n(c, "session_cooldown_hours", 3), n: n(c, "daily_session_limit", 4), m1: n(c, "minutes_base", 5), step: n(c, "minutes_step", 0.5) },
    s2: { rate: n(c, "base_rate_per_min", 2), mstep: n(c, "multiplier_step", 0.1), streak: n(c, "streak_bonus_pct", 2), streakcap: n(c, "streak_bonus_cap_pct", 20) },
    s4: { cost: costBase, growth, fac, max },
    s5: { cap: num(n(c, "daily_emission_cap", 0)) },
    s6: { min: n(c, "claim_min", 50), fee: n(c, "claim_fee_pct", 2) },
    s7: { wear: n(c, "shoe_wear_per_walk", 1), thr: n(c, "shoe_worn_threshold", 25), worn: n(c, "shoe_worn_reward_pct", 85), broken: n(c, "shoe_broken_reward_pct", 60) },
    s8: { minsol: n(c, "market_fee_min_sol", 0.01) },
    s10: { craft: n(c, "craft_min_level", 4) },
    s11: { qb: n(c, "quest_bonus_pct", 3) },
    s12: { ib: n(c, "invite_boost_pct", 10), id: n(c, "invite_boost_days", 7), im: n(c, "invite_max", 20) },
    s13: { rk: n(c, "ranking_min_km", 3), rn: n(c, "ranking_top_n", 10) },
    s9: { date: until, lo: n(c, "tester_level_min", 10), hi: n(c, "tester_level_max", 15) },
  };
  const h2 = "font-display text-lg text-white";
  const sec = (k: "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "s7" | "s8" | "s9" | "s10" | "s11" | "s12" | "s13" | "s14") => (
    <section key={k} className="glass space-y-2 p-5">
      <h2 className={h2}>{t(`rules.${k}.t` as "rules.s1.t")}</h2>
      <p className="text-sm leading-relaxed text-slate-300">{t(`rules.${k}.p` as "rules.s1.p", p[k] ?? {})}</p>
      {k === "s3" && (
        <div className="grid grid-cols-5 gap-2 pt-2">
          {RAR.map(([r, col]) => (
            <div key={r} className="rounded-xl border bg-white/5 p-2 text-center" style={{ borderColor: col }}>
              <p className="text-[11px]" style={{ color: col }}>{t(`rar.${r}` as "rar.common")}</p>
              <p className="font-display text-base text-white">{t("rules.mult", { m: mult[r] ?? 1 })}</p>
            </div>
          ))}
        </div>
      )}
      {k === "s4" && (
        <div className="max-h-72 overflow-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-night text-xs text-slate-400"><tr><th className="px-3 py-2">{t("rules.s4.lv")}</th><th className="px-3 py-2">{t("rules.s4.cost")}</th><th className="px-3 py-2">{t("rules.s4.time")}</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.lv} className="border-t border-white/5 text-slate-200"><td className="px-3 py-1.5">{r.lv} → {r.lv + 1}</td><td className="px-3 py-1.5">{num(r.cost)}</td><td className="px-3 py-1.5">{dur(r.min)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <Back />
      <h1 className="font-display text-3xl text-white">{t("rules.title")}</h1>
      <p className="text-slate-300">{t("rules.intro")}</p>
      {(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12", "s13", "s14"] as const).map(sec)}
    </main>
  );
}
