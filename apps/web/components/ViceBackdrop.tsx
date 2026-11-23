"use client";

const W = 300, H = 300, HOR = 168; // ligne d'horizon

const PINK = "#FF2E93", CYAN = "#22E4FF", VIOLET = "#7A2CFF", SUN1 = "#FFD84A", SUN2 = "#FF3D8B";
// Profondeur → position verticale (perspective) pour les lignes de la grille qui défilent.
const Y_VALUES = [0, 0.04, 0.12, 0.26, 0.48, 0.75, 1].map((t) => (HOR + t * (H - HOR)).toFixed(1)).join(";");

const BUILDINGS: [number, number, number][] = [ // x, largeur, hauteur
  [0, 26, 38], [24, 18, 58], [40, 24, 44], [62, 16, 70], [76, 28, 40], [102, 20, 52], [120, 16, 34],
  [180, 20, 46], [198, 26, 64], [222, 18, 40], [238, 24, 56], [260, 20, 36], [278, 22, 48],
];

function Palm({ x, flip = false, h = 150 }: { x: number; flip?: boolean; h?: number }) {
  const s = flip ? -1 : 1;
  const top = HOR + 20 - h;
  return (
    <g transform={`translate(${x},0) scale(${s},1)`} fill="#120726" stroke="#120726">
      <path d={`M0 ${HOR + 20} C 6 ${HOR - h * 0.3}, -4 ${HOR - h * 0.6}, 8 ${top}`} fill="none" strokeWidth="5" strokeLinecap="round" />
      {[-70, -35, 0, 35, 70, 110, -110].map((a, i) => (
        <path key={i} transform={`translate(8,${top}) rotate(${a})`} d="M0 0 C 14 -12, 34 -10, 44 6 C 30 -2, 14 -2, 0 4 Z" strokeWidth="1" />
      ))}
    </g>
  );
}

/** Fond « Vice City » (synthwave, soleil rayé, palmiers, ville néon) : remplace la carte quand la localisation est refusée. Création originale. */
export function ViceBackdrop({ moving }: { moving: boolean }) {
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" aria-hidden>
      <defs>
        <linearGradient id="vc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B0B45" /><stop offset=".45" stopColor="#6A1B9A" /><stop offset=".8" stopColor="#FF4D8D" /><stop offset="1" stopColor="#FF9F5A" />
        </linearGradient>
        <linearGradient id="vc-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={SUN1} /><stop offset="1" stopColor={SUN2} /></linearGradient>
        <linearGradient id="vc-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2A0B52" /><stop offset="1" stopColor="#0A0418" /></linearGradient>
        <mask id="vc-stripes">
          <rect width={W} height={H} fill="#fff" />
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x="0" y={104 + i * 11} width={W} height={1.5 + i * 0.9} fill="#000" />)}
        </mask>
      </defs>
      <rect width={W} height={HOR} fill="url(#vc-sky)" />
      {/* étoiles */}
      {[[20, 14], [64, 34], [110, 10], [190, 22], [240, 12], [275, 40], [150, 40]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" fill="#fff" opacity=".8" />)}
      <circle cx="150" cy="116" r="54" fill="url(#vc-sun)" mask="url(#vc-stripes)" style={{ filter: `drop-shadow(0 0 18px ${PINK})` }} />
      {/* ville */}
      <g fill="#1A0838">
        {BUILDINGS.map(([x, w, h], i) => <rect key={i} x={x} y={HOR - h} width={w} height={h} />)}
      </g>
      {BUILDINGS.map(([x, w, h], i) => (
        <g key={`w${i}`} fill={i % 2 ? CYAN : PINK} opacity=".75">
          {[0, 1, 2].map((k) => <rect key={k} x={x + 4 + (k % 2) * 7} y={HOR - h + 6 + k * 11} width="3" height="3" />)}
        </g>
      ))}
      <Palm x={18} h={168} /><Palm x={290} flip h={150} />
      {/* sol + grille */}
      <rect y={HOR} width={W} height={H - HOR} fill="url(#vc-ground)" />
      <line x1="0" x2={W} y1={HOR} y2={HOR} stroke={CYAN} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 4px ${CYAN})` }} />
      <g stroke={VIOLET} strokeWidth="1" opacity=".9">
        {Array.from({ length: 15 }, (_, i) => { const x = -300 + i * 60; return <line key={i} x1={150} y1={HOR} x2={x} y2={H} />; })}
      </g>
      <g stroke={PINK} strokeWidth="1.2" opacity=".85" key={moving ? "m" : "s"}>
        {[0, 1, 2, 3, 4, 5].map((i) => moving ? (
          <line key={i} x1="0" x2={W} y1={HOR} y2={HOR}>
            <animate attributeName="y1" dur="2.4s" begin={`${-i * 0.4}s`} repeatCount="indefinite" values={Y_VALUES} />
            <animate attributeName="y2" dur="2.4s" begin={`${-i * 0.4}s`} repeatCount="indefinite" values={Y_VALUES} />
          </line>
        ) : (
          <line key={i} x1="0" x2={W} y1={HOR + ([0.04, 0.12, 0.26, 0.48, 0.75, 1][i]!) * (H - HOR)} y2={HOR + ([0.04, 0.12, 0.26, 0.48, 0.75, 1][i]!) * (H - HOR)} />
        ))}
      </g>
    </svg>
  );
}
