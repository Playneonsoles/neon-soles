"use client";

import { BADGES } from "@walk/game";
import { useI18n } from "@/lib/i18n";

/** Pastilles de badges (équipe, investisseur, OG…) : petite icône colorée avec le nom au survol ; `full` affiche aussi le nom. */
export function Badges({ codes, full = false, className = "" }: { codes: readonly string[] | undefined; full?: boolean; className?: string }) {
  const { t } = useI18n();
  const list = (codes ?? []).map((c) => BADGES.find((b) => b.code === c)).filter((b): b is (typeof BADGES)[number] => Boolean(b));
  if (list.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap items-center justify-center gap-1 ${className}`}>
      {list.map((b) => {
        const name = t(`badge.${b.code}` as "badge.team");
        return (
          <span key={b.code} title={name} aria-label={name} className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none" style={{ borderColor: `${b.color}99`, background: `${b.color}1f`, color: b.color }}>
            <span aria-hidden>{b.icon}</span>{full && <span className="font-semibold">{name}</span>}
          </span>
        );
      })}
    </span>
  );
}
