import { districtOf } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { ShoeSprite, type ShoeVisual } from "./ShoeSprite";

/** Chaussure de l'accueil : celle du joueur, avec les effets de son niveau ou de ses caractéristiques. */
export function ShoeHero({ level, visual }: { level: number; visual: ShoeVisual }) {
  const { t } = useI18n();
  const d = districtOf(level);
  return (
    <div className="relative rounded-3xl border border-white/10 px-10 pb-6 pt-12" style={{ background: `radial-gradient(420px 220px at 50% 60%, ${visual.color}33, transparent 70%), #0e1424` }}>
      <p className="text-sm text-slate-300">{t("home.district", { d: t(`district.${d}` as "district.0") })}</p>
      <ShoeSprite visual={visual} level={level} className="mx-auto mt-2 w-full max-w-sm" />
      <p className="mt-2 text-center font-display text-sm text-slate-200">{t("home.levelLine", { n: level })}{visual.tier ? ` · ${visual.tier}` : ""}</p>
    </div>
  );
}
