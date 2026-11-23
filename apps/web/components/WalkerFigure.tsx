"use client";

import { avatarSvg } from "@/lib/avatars";
import { ShoeShape, Wings, type ShoeVisual } from "./ShoeSprite";

/**
 * Personnage choisi dans le profil, en pied (de la tête aux chaussures), avec les chaussures équipées :
 * elles brillent fort, et les ailes (dans le dos) grandissent avec le niveau de la chaussure.
 * Quand le joueur marche, les jambes et les bras se balancent. Dessin vectoriel original.
 */
export function WalkerFigure({ face, visual, level, walking, className = "", style }: { face: number | null | undefined; visual: ShoeVisual; level: number; walking: boolean; className?: string; style?: React.CSSProperties }) {
  const raw = avatarSvg(face ?? 0, "head");
  const body = /data-body="(#[0-9A-Fa-f]{3,6})"/.exec(raw)?.[1] ?? "#334155";
  const skin = /data-skin="(#[0-9A-Fa-f]{3,6})"/.exec(raw)?.[1] ?? "#F1C9A5";
  const head = raw.replace('<svg viewBox="0 0 100 100"', '<svg x="50" y="0" width="120" height="120" viewBox="0 0 100 100"');
  const c = visual.color;
  const has = (e: string) => (visual.effects as readonly string[]).includes(e);
  const strong = `drop-shadow(0 0 5px ${c}) drop-shadow(0 0 12px ${c}) drop-shadow(0 0 24px ${c})`;
  const swing = (from: number, to: number, begin: string, cx: number, cy: number, dur = "0.6s") => walking
    ? <animateTransform attributeName="transform" type="rotate" values={`${from} ${cx} ${cy};${to} ${cx} ${cy};${from} ${cx} ${cy}`} dur={dur} begin={begin} repeatCount="indefinite" /> : null;
  const lift = (begin: string) => walking
    ? <animateTransform attributeName="transform" type="translate" values="0 0;0 -13;0 0" dur="0.6s" begin={begin} repeatCount="indefinite" /> : null;

  const leg = (x: number, begin: string, right: boolean) => (
    <g key={x}>
      {lift(begin)}
      <rect x={x - 9} y="196" width="18" height="78" rx="8" fill="#1E293B" />
      <rect x={x - 9} y="246" width="18" height="12" fill={c} opacity=".85" />
      <g style={{ color: c, filter: strong }} className={walking ? "sx-shine" : ""}>
        <g transform={right ? `translate(${x - 31} 259) scale(.28)` : `translate(${x + 31} 259) scale(-.28 .28)`}><ShoeShape /></g>
      </g>
    </g>
  );

  return (
    <svg viewBox="0 0 220 330" role="img" aria-label={visual.tier ?? "walker"} className={className} style={{ overflow: "visible", ...style }}>
      {has("aura") && <ellipse className="sx-aura" cx="110" cy="170" rx="104" ry="150" fill="none" stroke={c} strokeWidth="3" opacity=".4" style={{ filter: `drop-shadow(0 0 8px ${c})` }} />}
      <Wings level={level} color={c} lx={70} rx={150} y={132} base={0.55} span={1.35} />
      <ellipse cx="110" cy="302" rx="74" ry="8" fill="#000" opacity=".35" />

      {/* bras (derrière le buste) */}
      <g>{swing(-26, 26, "0s", 68, 124)}<rect x="56" y="118" width="15" height="62" rx="7.5" fill={body} /><circle cx="63.5" cy="184" r="8" fill={skin} /></g>
      <g>{swing(26, -26, "0s", 152, 124)}<rect x="149" y="118" width="15" height="62" rx="7.5" fill={body} /><circle cx="156.5" cy="184" r="8" fill={skin} /></g>

      {leg(94, "0s", false)}
      {leg(126, "-0.3s", true)}

      {/* torse + buste du personnage choisi */}
      <path d="M72 112 H148 L142 204 Q110 214 78 204Z" fill={body} />
      <path d="M80 198 Q110 208 140 198" fill="none" stroke="#0B1020" strokeOpacity=".35" strokeWidth="4" />
      <g dangerouslySetInnerHTML={{ __html: head }} />

      {walking && (has("lightning") || level >= 3) && (
        <g fill="none" stroke="#67E8F9" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px #67E8F9)" }}>
          <polyline className="sx-zap" points="26,252 42,276 30,276 46,302" />
          <polyline className="sx-zap" points="194,252 178,276 190,276 174,302" style={{ animationDelay: ".45s" }} />
        </g>
      )}
    </svg>
  );
}
