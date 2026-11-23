"use client";

import type { ShoeEffect } from "@walk/game";
import { useI18n } from "@/lib/i18n";

export interface ShoeVisual { color: string; effects: readonly ShoeEffect[]; tier?: string }

/**
 * Chaussure du joueur (dessin vectoriel, même modèle que le site) avec les effets de son niveau ou de ses caractéristiques.
 * Un modèle 3D (.glb) pourra remplacer le dessin plus tard : seul ce composant change.
 */
export function ShoeSprite({ visual, level, walking = false, className = "" }: { visual: ShoeVisual; level: number; walking?: boolean; className?: string }) {
  const { t } = useI18n();
  const has = (e: ShoeEffect) => visual.effects.includes(e);
  const c = visual.color;
  const glow = (has("glow") ? 8 + level * 1.5 : 4) + (walking ? 14 : 0);
  return (
    <svg viewBox="0 0 420 240" role="img" aria-label={t("common.level", { n: level })} className={className} style={{ color: c, overflow: "visible" }}>
      {has("halo") && <ellipse cx="205" cy="26" rx="62" ry="12" fill="none" stroke="#FDE68A" strokeWidth="6" style={{ filter: "drop-shadow(0 0 10px #FDE68A)" }} />}
      {has("aura") && <ellipse className="sx-aura" cx="210" cy="140" rx="168" ry="92" fill="none" stroke="currentColor" strokeWidth="3" opacity=".45" style={{ filter: "drop-shadow(0 0 14px currentColor)", transformOrigin: "210px 140px" }} />}
      {level >= 2 && <Wings level={level} color={c} />}
      {has("trail") && (
        <g fill="#FBBF24">
          <rect className="sx-trail" x="20" y="150" width="60" height="6" rx="3" />
          <rect className="sx-trail" x="10" y="166" width="80" height="6" rx="3" style={{ animationDelay: ".3s" }} />
          <rect className="sx-trail" x="30" y="182" width="50" height="6" rx="3" style={{ animationDelay: ".6s" }} />
        </g>
      )}
      <g transform="translate(52 52) scale(.96)"><g className={walking ? "sx-step sx-shine" : ""} style={{ filter: `drop-shadow(0 0 ${glow}px ${c})`, transformOrigin: "center", transformBox: "fill-box" }}>
        <ShoeShape />
      </g></g>
      {has("lightning") && (
        <g fill="none" stroke="#67E8F9" strokeWidth="4">
          <polyline className="sx-zap" points="90,40 110,90 90,90 120,150" />
          <polyline className="sx-zap" points="320,30 300,80 322,80 296,140" style={{ animationDelay: ".7s" }} />
        </g>
      )}
      {walking && (
        <g className="sx-bolt" style={{ filter: "drop-shadow(0 0 10px #FDE047) drop-shadow(0 0 20px #FACC15)", transformOrigin: "210px 70px" }} aria-hidden>
          <path d="M226 0 170 82h38l-16 64 66-92h-40z" fill="#FDE047" stroke="#FFFBEB" strokeWidth="3" strokeLinejoin="round" transform="translate(0 -6) scale(.85)" />
        </g>
      )}
      {has("sparkles") && [[76, 72], [330, 58], [214, 30], [360, 150], [44, 168]].map(([x, y], i) => (
        <circle key={i} className="sx-twinkle" cx={x} cy={y} r="4.5" fill="#fff" style={{ animationDelay: `${i * 0.35}s`, filter: "drop-shadow(0 0 6px currentColor)", transformOrigin: `${x}px ${y}px` }} />
      ))}
    </svg>
  );
}

/** Dessin de la chaussure seule (tournée vers la droite, couleur = currentColor), partagé avec le personnage de la carte. */
export function ShoeShape() {
  return (
    <>
      <path d="M30 118L34 62Q36 50 48 48L92 42L100 18Q104 8 116 10L152 20L160 54Q178 72 216 78Q268 86 294 102Q304 110 302 122L302 124L30 124Z" fill="#2C3770" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M216 78Q268 86 294 102Q304 110 302 122L246 122Z" fill="currentColor" opacity=".4" />
      <path d="M62 66L116 70L92 92L138 96L78 120" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="square" />
      <path d="M110 24l42 11M114 38l42 11M120 52l38 10" stroke="#F2F5FF" strokeWidth="3" strokeLinecap="round" />
      <path d="M34 62L10 40L44 50Z" fill="currentColor" />
      <path d="M104 12L132 4L124 22Z" fill="currentColor" />
      <path d="M22 124H310Q314 124 312 134Q307 148 290 148H46Q26 148 22 134Z" fill="#F2F5FF" />
      <path d="M36 136H296" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </>
  );
}

/**
 * Ailes : de minuscules ailerons au niveau 2 à des ailes immenses au niveau 20 (échelle 0,35 → 2,5), avec de plus en plus de plumes.
 * Dessinées d'un seul côté puis retournées pour l'autre aile.
 */
export function Wings({ level, color, lx = 120, rx = 300, y = 118, base = 0.35, span = 2.15 }: { level: number; color: string; lx?: number; rx?: number; y?: number; base?: number; span?: number }) {
  const k = Math.min(Math.max((level - 1) / 19, 0), 1);
  const scale = base + k * span;
  const feathers = Math.min(9, 2 + Math.floor(level / 2.5));
  const blades = Array.from({ length: feathers }, (_, i) => {
    const t = feathers === 1 ? 0 : i / (feathers - 1);
    const ang = ((20 + t * 62) * Math.PI) / 180;         // du bas vers le haut de l'aile
    const len = 78 - t * 22 + (i % 2) * 6;               // plumes basses plus longues
    const x = -Math.cos(ang) * len, y = -Math.sin(ang) * len;
    const nx = Math.sin(ang) * len * 0.2, ny = -Math.cos(ang) * len * 0.2;
    return `M0 0Q${(x / 2 + nx).toFixed(1)} ${(y / 2 + ny).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}Q${(x / 2 - nx).toFixed(1)} ${(y / 2 - ny).toFixed(1)} 0 0Z`;
  });
  const wing = (
    <g>
      <animateTransform attributeName="transform" type="rotate" values="0;-9;0" dur="1.3s" repeatCount="indefinite" />
      {blades.map((d, i) => <path key={i} d={d} fill={color} fillOpacity={0.55 + (i / feathers) * 0.3} stroke="#fff" strokeOpacity=".55" strokeWidth={1.4 / Math.max(scale, 0.5)} strokeLinejoin="round" />)}
    </g>
  );
  return (
    <g style={{ filter: `drop-shadow(0 0 ${6 + k * 14}px ${color})` }} aria-hidden>
      <g transform={`translate(${lx} ${y}) scale(${scale})`}>{wing}</g>
      <g transform={`translate(${rx} ${y}) scale(${-scale} ${scale})`}>{wing}</g>
    </g>
  );
}
