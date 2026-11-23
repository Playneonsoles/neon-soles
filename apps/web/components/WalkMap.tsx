"use client";

import { useI18n } from "@/lib/i18n";
import { useNearby, type Geo } from "@/lib/nearby";
import { LandmarkAlert } from "./LandmarkAlert";
import { type ShoeVisual } from "./ShoeSprite";
import { ViceBackdrop } from "./ViceBackdrop";
import { WalkerFigure } from "./WalkerFigure";

export interface MapPoint { lat: number; lng: number }

const VIEW = 300;        // taille de la carte à l'écran (px)
const METERS_ACROSS = 140; // largeur de carte visible, en mètres

/**
 * Carte de marche : un plan stylisé qui défile sous les pieds du joueur, avec son tracé.
 * Le joueur est représenté par SA chaussure (pas un personnage). Autour de lui : routes, chemins, parcs, eaux et petits lieux
 * issus d'OpenStreetMap (données ouvertes, voir lib/nearby.ts). Sans réseau ou sans réponse, la carte reste un simple quadrillage.
 */
export function WalkMap({ points, visual, level, moving, face, denied = false }: { points: MapPoint[]; visual: ShoeVisual; level: number; moving: boolean; face: number | null | undefined; denied?: boolean }) {
  const { t } = useI18n();
  const cur = points.at(-1);
  const near = useNearby(cur, !denied);
  const scale = VIEW / METERS_ACROSS; // px par mètre
  const mPerDegLat = 111_320;
  const mPerDegLng = cur ? 111_320 * Math.cos((cur.lat * Math.PI) / 180) : 111_320;
  const toXY = (p: MapPoint) => cur ? { x: (p.lng - cur.lng) * mPerDegLng * scale, y: -(p.lat - cur.lat) * mPerDegLat * scale } : { x: 0, y: 0 };
  const xy = (p: Geo) => { const q = toXY({ lat: p.lat, lng: p.lng }); return `${(VIEW / 2 + q.x).toFixed(1)},${(VIEW / 2 + q.y).toFixed(1)}`; };
  const ICON: Record<string, string> = { cafe: "☕", restaurant: "🍴", drinking_water: "💧", fountain: "⛲", toilets: "🚻", bench: "🪑", pharmacy: "⚕️", bicycle_parking: "🚲" };
  const trail = points.slice(-120).map((p) => toXY(p)).map(({ x, y }) => `${(VIEW / 2 + x).toFixed(1)},${(VIEW / 2 + y).toFixed(1)}`).join(" ");
  // Le quadrillage se décale avec la position réelle pour donner l'impression d'avancer (bloc de 20 m).
  const cell = 20 * scale;
  const off = cur ? { x: (((cur.lng * mPerDegLng * scale) % cell) + cell) % cell, y: ((((-cur.lat * mPerDegLat * scale)) % cell) + cell) % cell } : { x: 0, y: 0 };

  return (
    <>
    <div className="relative mx-auto overflow-hidden rounded-3xl border border-white/15" style={{ width: VIEW, height: VIEW, background: denied ? "#1B0B45" : "radial-gradient(circle at 50% 50%, #17213d, #0b1020)" }} role="img" aria-label={t("walk.mapAria")}>
      {denied && <ViceBackdrop moving={moving} />}
      {!denied && <svg width={VIEW} height={VIEW} className="absolute inset-0" aria-hidden>
        <g stroke={denied ? "rgba(203,213,225,.10)" : "rgba(103,232,249,.14)"} strokeWidth="1">
          {Array.from({ length: Math.ceil(VIEW / cell) + 2 }, (_, i) => (
            <g key={i}>
              <line x1={i * cell - off.x} y1="0" x2={i * cell - off.x} y2={VIEW} />
              <line x1="0" y1={i * cell - off.y} x2={VIEW} y2={i * cell - off.y} />
            </g>
          ))}
        </g>
        {near?.areas.map((a, i) => (
          <polygon key={`a${i}`} points={a.pts.map(xy).join(" ")} fill={a.kind === "water" ? "rgba(56,189,248,.28)" : "rgba(57,255,136,.18)"} stroke={a.kind === "water" ? "rgba(56,189,248,.5)" : "rgba(57,255,136,.35)"} strokeWidth="1" />
        ))}
        {near?.roads.map((r, i) => (
          <polyline key={`r${i}`} points={r.pts.map(xy).join(" ")} fill="none" stroke={r.kind === "foot" ? "rgba(253,224,71,.55)" : "rgba(226,232,240,.35)"}
            strokeWidth={r.kind === "major" ? 6 : r.kind === "minor" ? 3.5 : 2} strokeDasharray={r.kind === "foot" ? "4 3" : undefined} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {trail && <polyline points={trail} fill="none" stroke={visual.color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".75" style={{ filter: `drop-shadow(0 0 6px ${visual.color})` }} />}
      </svg>}
      {near?.pois.map((p, i) => {
        const q = toXY(p);
        const x = VIEW / 2 + q.x, y = VIEW / 2 + q.y;
        if (x < 6 || y < 6 || x > VIEW - 6 || y > VIEW - 6) return null;
        return <span key={`p${i}`} title={p.name ?? p.kind} className="absolute -translate-x-1/2 -translate-y-1/2 text-[13px] leading-none drop-shadow" style={{ left: x, top: y }} aria-hidden>{ICON[p.kind] ?? "📍"}</span>;
      })}
      {near?.landmarks.map((l, i) => {
        const p0 = l.pts[Math.floor(l.pts.length / 2)]!;
        const q = toXY(p0), x = VIEW / 2 + q.x, y = VIEW / 2 + q.y;
        if (x < 8 || y < 8 || x > VIEW - 8 || y > VIEW - 8) return null;
        return <span key={`l${i}`} title={l.name} className="absolute -translate-x-1/2 -translate-y-1/2 text-base leading-none drop-shadow-[0_0_6px_#FCD34D]" style={{ left: x, top: y }} aria-hidden>🏛️</span>;
      })}
      {/* La chaussure reste au centre ; elle « marche » (rebond) tant qu'on avance. */}
      <WalkerFigure face={face} visual={visual} level={level} walking={moving} className="absolute left-1/2 w-[132px] -translate-x-1/2" style={{ top: VIEW / 2 - 130 }} />
      {!denied && <span className="absolute bottom-1 right-2 text-[9px] text-slate-400">© OpenStreetMap</span>}
      {denied && <p className="absolute inset-x-3 top-2 rounded-lg bg-black/55 px-2 py-1 text-center text-[11px] text-amber-200">{t("walk.mapGrey")}</p>}
      {!cur && !denied && <p className="absolute inset-x-0 bottom-3 text-center text-xs text-slate-300">{t("walk.mapSearching")}</p>}
    </div>
    <LandmarkAlert cur={cur} landmarks={near?.landmarks ?? []} />
    </>
  );
}
