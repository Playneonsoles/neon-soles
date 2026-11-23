/* Avatars préparés : personnages originaux inspirés d'archétypes du cinéma (dessinés en SVG, aucun personnage ni personne réelle). */
interface Cos { body: string; back?: string; det?: string; over?: string; pre?: string; nofront?: boolean | number }
export const FACES = [
 {name:'Vale',role:'Secret Agent',cos:'spy',skin:'#FFE0C8',hair:'#3A7BFF',eye:'#1FB5FF',front:'swoop',back:'none'},
 {name:'Nova',role:'Space Pilot',cos:'pilot',skin:'#F7D2B5',hair:'#F472B6',eye:'#B45CFF',front:'bangs',back:'none'},
 {name:'Rook',role:'Pirate Captain',cos:'pirate',skin:'#8D5A3B',hair:'#EF4444',eye:'#FFD23F',front:'bangs',back:'long'},
 {name:'Merlo',role:'Wizard',cos:'wizard',skin:'#D49A6A',hair:'#E5E7EB',eye:'#2EE59D',front:'bangs',back:'long'},
 {name:'Dusty',role:'Cowboy',cos:'cowboy',skin:'#EBC29B',hair:'#B45309',eye:'#38BDF8',front:'spiky',back:'none'},
 {name:'Kenji',role:'Samurai',cos:'samurai',skin:'#E8B98F',hair:'#1F2937',eye:'#FF5C5C',front:'bangs',back:'none'},
 {name:'Sloane',role:'Detective',cos:'detective',skin:'#FFE6D2',hair:'#92400E',eye:'#3B82F6',front:'swoop',back:'long'},
 {name:'Atlas',role:'Superhero',cos:'hero',skin:'#C9906A',hair:'#14B8A6',eye:'#F43F5E',front:'spiky',back:'none'},
 {name:'Bjorn',role:'Viking Warrior',cos:'viking',skin:'#F1C9A5',hair:'#F59E0B',eye:'#22D3EE',front:'bangs',back:'none'},
 {name:'Cipher',role:'Hacker',cos:'hacker',skin:'#6B4430',hair:'#A3E635',eye:'#22C55E',front:'swoop',back:'none'},
 {name:'Brock',role:'Boxer',cos:'boxer',skin:'#B77B52',hair:'#0EA5E9',eye:'#FDE047',front:'spiky',back:'none'},
 {name:'Vex',role:'Rock Star',cos:'rock',skin:'#E8B98F',hair:'#EC4899',eye:'#A78BFA',front:'none',back:'none'},
 {name:'Marco',role:'Pastel Suit',cos:'miami',skin:'#E9B48A',hair:'#1F1720',eye:'#38BDF8',front:'swoop',back:'none'},
 {name:'Lola',role:'Disco Queen',cos:'disco',skin:'#9A5B3C',hair:'#F472B6',eye:'#FDE047',front:'bangs',back:'long'},
 {name:'Rico',role:'Speedboat Racer',cos:'racer',skin:'#F1C9A5',hair:'#7C2D12',eye:'#22D3EE',front:'swoop',back:'none'},
 {name:'Dex',role:'Roller Skater',cos:'skater',skin:'#D9A276',hair:'#06B6D4',eye:'#F43F5E',front:'spiky',back:'none'}];
export function avatarSvg(face: number, size?: string): string {
  const f = FACES[face] ?? (FACES[0] as (typeof FACES)[number]), hc = f.hair, c = f.cos, id = 'c' + face + (size || '');
  const COSMAP: Record<string, Cos> = {
    spy:{body:'#111827',det:`<path d="M40 79L50 97L60 79Z" fill="#fff"/><path d="M38 79L32 100M62 79L68 100" stroke="#374151" stroke-width="3"/><path d="M44 83l6 3 6-3v7l-6-3-6 3z" fill="#E11D48"/>`,over:`<path d="M74 50q5 6 0 13" fill="none" stroke="#9CA3AF" stroke-width="2"/>`},
    pilot:{body:'#F97316',back:`<ellipse cx="50" cy="38" rx="31" ry="30" fill="#E5E7EB" stroke="#94A3B8" stroke-width="2"/>`,det:`<ellipse cx="50" cy="81" rx="17" ry="5" fill="#E5E7EB"/><rect x="62" y="88" width="10" height="6" rx="1" fill="#fff"/>`,over:`<path d="M26 32Q50 20 74 32L74 41Q50 31 26 41Z" fill="#38BDF8" opacity=".75"/><path d="M33 29Q44 24 54 25" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>`,nofront:1},
    pirate:{body:'#B91C1C',det:`<circle cx="42" cy="90" r="2" fill="#FBBF24"/><circle cx="58" cy="90" r="2" fill="#FBBF24"/><path d="M38 79L50 96L62 79" stroke="#FBBF24" stroke-width="3" fill="none"/>`,over:`<ellipse cx="38" cy="52" rx="8.5" ry="10" fill="#111"/><path d="M27 42L73 38" stroke="#111" stroke-width="2"/><path d="M12 38L50 6L88 38Q50 28 12 38Z" fill="#1F2937"/><path d="M12 38Q50 28 88 38L84 43Q50 34 16 43Z" fill="#FBBF24"/><circle cx="50" cy="24" r="4.5" fill="#fff"/>`},
    wizard:{body:'#6D28D9',det:`<path d="M50 84l2 5 5 .5-4 3.5 1.2 5L50 95l-4.2 3 1.2-5-4-3.5 5-.5z" fill="#FDE047"/>`,over:`<path d="M34 66Q50 100 66 66Q58 76 50 76Q42 76 34 66Z" fill="#E5E7EB"/><path d="M20 36Q50 26 80 36L56 -6Q50 -10 44 -2Z" fill="#4C1D95"/><ellipse cx="50" cy="35" rx="33" ry="7" fill="#4C1D95"/><path d="M50 18l2 4.5 5 .5-3.7 3.2 1.1 4.8L50 28.6 45.6 31l1.1-4.8L43 23l5-.5z" fill="#FDE047"/>`},
    cowboy:{body:'#92400E',det:`<path d="M38 79L50 98L62 79Z" fill="#DC2626"/><path d="M40 79L50 100L60 79" stroke="#451A03" stroke-width="2" fill="none"/>`,over:`<ellipse cx="50" cy="32" rx="42" ry="9" fill="#78350F"/><path d="M30 32Q30 6 50 6Q70 6 70 32Z" fill="#92400E"/><rect x="30" y="25" width="40" height="5" fill="#451A03"/>`},
    samurai:{body:'#1E293B',back:`<circle cx="50" cy="9" r="8" fill="${hc}"/>`,det:`<path d="M36 79L58 100M64 79L46 100" stroke="#F8FAFC" stroke-width="4"/>`,over:`<path d="M27 33Q50 24 73 33L73 39Q50 30 27 39Z" fill="#F8FAFC"/><circle cx="50" cy="32" r="3.2" fill="#DC2626"/><path d="M73 36l10 8M73 38l8 12" stroke="#F8FAFC" stroke-width="3" stroke-linecap="round"/>`},
    detective:{body:'#CA8A04',det:`<path d="M30 80L38 68L50 86L62 68L70 80L72 100L28 100Z" fill="#A16207"/><path d="M50 86V100" stroke="#713F12" stroke-width="2"/>`,over:`<ellipse cx="50" cy="30" rx="38" ry="8" fill="#374151"/><path d="M31 30Q31 8 50 8Q69 8 69 30Z" fill="#4B5563"/><rect x="31" y="23" width="38" height="5" fill="#111827"/>`},
    hero:{body:'#2563EB',back:`<path d="M8 100Q12 68 30 68L70 68Q88 68 92 100Z" fill="#DC2626"/>`,det:`<path d="M50 82l6 8-6 8-6-8z" fill="#FACC15"/>`,pre:`<path d="M26 44Q38 38 50 44Q62 38 74 44L74 61Q62 55 50 61Q38 55 26 61Z" fill="#111827"/>`},
    viking:{body:'#92400E',det:`<ellipse cx="50" cy="83" rx="30" ry="8" fill="#E5E7EB"/>`,over:`<path d="M30 58Q23 76 29 92" fill="none" stroke="${hc}" stroke-width="6" stroke-linecap="round"/><path d="M70 58Q77 76 71 92" fill="none" stroke="${hc}" stroke-width="6" stroke-linecap="round"/><path d="M26 42Q26 12 50 12Q74 12 74 42L70 36Q50 26 30 36Z" fill="#9CA3AF"/><path d="M28 32Q6 30 4 6Q18 16 33 24Z" fill="#F3F4F6"/><path d="M72 32Q94 30 96 6Q82 16 67 24Z" fill="#F3F4F6"/><rect x="48" y="14" width="4" height="14" fill="#6B7280"/>`},
    hacker:{body:'#111827',back:`<path d="M18 100Q14 36 50 10Q86 36 82 100Z" fill="#1F2937"/>`,det:`<path d="M44 82v12M56 82v12" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>`,over:`<rect x="26" y="44" width="21" height="14" rx="3" fill="#22C55E" fill-opacity=".3" stroke="#22C55E" stroke-width="2.2"/><rect x="53" y="44" width="21" height="14" rx="3" fill="#22C55E" fill-opacity=".3" stroke="#22C55E" stroke-width="2.2"/><path d="M47 50h6" stroke="#22C55E" stroke-width="2.2"/><path d="M25 52Q22 22 50 18Q78 22 75 52" fill="none" stroke="#1F2937" stroke-width="6"/>`},
    boxer:{body:'#DC2626',det:`<path d="M36 79L50 100L64 79" stroke="#fff" stroke-width="4" fill="none"/>`,over:`<rect x="59" y="56" width="10" height="4.5" rx="1" fill="#FDE68A" transform="rotate(-20 64 58)"/><circle cx="20" cy="72" r="12" fill="#B91C1C"/><circle cx="80" cy="72" r="12" fill="#B91C1C"/><rect x="14" y="80" width="12" height="7" rx="2" fill="#fff"/><rect x="74" y="80" width="12" height="7" rx="2" fill="#fff"/>`},
    rock:{body:'#111827',det:`<path d="M34 79L44 93L50 80L56 93L66 79" fill="none" stroke="#9CA3AF" stroke-width="3"/><circle cx="40" cy="92" r="1.6" fill="#E5E7EB"/><circle cx="60" cy="92" r="1.6" fill="#E5E7EB"/>`,over:`<path d="M36 34L34 8L43 22L48 -2L53 22L59 4L63 24L68 12L66 36Q50 26 36 34Z" fill="${hc}"/><rect x="28" y="44" width="19" height="10" rx="4" fill="#0B0F1A"/><rect x="53" y="44" width="19" height="10" rx="4" fill="#0B0F1A"/><rect x="46" y="47" width="8" height="2.5" fill="#0B0F1A"/><path d="M31 47h8" stroke="#F472B6" stroke-width="1.8" stroke-linecap="round"/>`,nofront:1},
    miami:{body:'#F9A8D4',det:`<path d="M40 79L50 97L60 79Z" fill="#2DD4BF"/><path d="M34 79L48 100M66 79L52 100" stroke="#EC4899" stroke-width="3.5"/><circle cx="50" cy="90" r="1.6" fill="#FDE68A"/>`,over:`<path d="M29 47h19v9Q47 62 38 61Q30 60 29 53Z" fill="#0B1020"/><path d="M52 47h19v6Q70 60 62 61Q53 62 52 56Z" fill="#0B1020"/><path d="M48 49h4" stroke="#0B1020" stroke-width="2"/><path d="M33 50l7 0M56 50l7 0" stroke="#F472B6" stroke-width="1.6" stroke-linecap="round"/>`},
    disco:{body:'#7C3AED',det:`<path d="M36 79L50 98L64 79" fill="#FDE047" opacity=".9"/><circle cx="30" cy="88" r="1.5" fill="#fff"/><circle cx="70" cy="92" r="1.5" fill="#fff"/><circle cx="44" cy="94" r="1.2" fill="#F0ABFC"/><circle cx="58" cy="86" r="1.2" fill="#F0ABFC"/>`,over:`<path d="M30 40Q50 32 70 40" fill="none" stroke="#FDE047" stroke-width="3.5" stroke-linecap="round"/><path d="M27 66l3 5 3-5-3-5z" fill="#FDE047"/><path d="M73 66l3 5 3-5-3-5z" fill="#FDE047"/>`},
    racer:{body:'#F8FAFC',det:`<path d="M34 79L50 99L66 79Z" fill="#1E3A8A"/><path d="M44 84h12" stroke="#FBBF24" stroke-width="2"/><path d="M42 90h16" stroke="#FBBF24" stroke-width="2"/>`,over:`<path d="M26 36Q50 12 74 36L74 40L26 40Z" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5"/><path d="M24 40Q50 46 76 40L76 45Q50 51 24 45Z" fill="#1E3A8A"/><circle cx="50" cy="30" r="4" fill="#FBBF24"/>`,nofront:true},
    skater:{body:'#06B6D4',det:`<path d="M30 100L38 82L50 90L62 82L70 100Z" fill="#F43F5E"/><path d="M30 92h40" stroke="#fff" stroke-width="3"/>`,over:`<rect x="26" y="34" width="48" height="6" rx="3" fill="#F43F5E"/><path d="M73 36Q86 34 90 44" fill="none" stroke="#F43F5E" stroke-width="4" stroke-linecap="round"/><path d="M26 40h48" stroke="#fff" stroke-width="1.5" opacity=".7"/>`},
  };
  const COS = COSMAP[c] as Cos;
  // Mode « head » : buste sans le disque de fond (pour le personnage en pied de la carte) ; la couleur du vêtement est exposée dans data-body.
  let s = size === 'head'
    ? `<svg viewBox="0 0 100 100" overflow="visible" data-body="${COS.body}" data-skin="${f.skin}" role="img" aria-label="${f.name}, ${f.role}"><g>`
    : `<svg viewBox="0 0 100 100" class="av ${size === 'big' ? 'big' : ''}" role="img" aria-label="${f.name}, ${f.role}"><circle cx="50" cy="50" r="50" fill="#1B2547"/><clipPath id="${id}"><circle cx="50" cy="50" r="50"/></clipPath><g clip-path="url(#${id})">`;
  if (f.back === 'long') s += `<path d="M24 50Q20 12 50 12Q80 12 76 50L80 92L20 92Z" fill="${hc}"/>`;
  s += (COS.back || '');
  s += `<path d="M14 100Q16 80 50 78Q84 80 86 100Z" fill="${COS.body}"/>${COS.det || ''}`;
  s += `<rect x="44" y="64" width="12" height="16" rx="5" fill="${f.skin}"/><path d="M28 44Q28 24 50 24Q72 24 72 44Q72 60 50 74Q28 60 28 44Z" fill="${f.skin}"/>`;
  s += `<ellipse cx="34" cy="60" rx="5" ry="3" fill="#FF6B8A" opacity=".35"/><ellipse cx="66" cy="60" rx="5" ry="3" fill="#FF6B8A" opacity=".35"/>${COS.pre || ''}`;
  [38, 62].forEach((x, i) => {
    const d = i ? 1 : -1;
    s += `<ellipse cx="${x}" cy="52" rx="7" ry="9" fill="#fff"/><ellipse cx="${x}" cy="53" rx="5.6" ry="8" fill="${f.eye}"/><ellipse cx="${x}" cy="54" rx="2.8" ry="4.6" fill="#16162A"/><circle cx="${x - d * 2}" cy="49" r="2.3" fill="#fff"/><circle cx="${x + d * 2}" cy="57.5" r="1.1" fill="#fff"/><path d="M${x - 8} 49Q${x} 41 ${x + 8} 49" fill="none" stroke="#16162A" stroke-width="2.6" stroke-linecap="round"/><path d="M${x - 8} 39Q${x} 37 ${x + 8} 38" fill="none" stroke="${hc}" stroke-width="2.2" stroke-linecap="round"/>`;
  });
  s += `<path d="M50 59l-1.5 3 2 .6" fill="none" stroke="#7a3b2a" stroke-opacity=".6" stroke-width="1.2" stroke-linecap="round"/><path d="M45 66Q50 69.5 55 66" fill="none" stroke="#9a3b3b" stroke-width="2" stroke-linecap="round"/>`;
  if (!COS.nofront) {
    if (f.front === 'spiky') s += `<path d="M24 48Q18 18 50 12Q82 18 76 48L71 34L66 46L58 26L50 44L42 26L34 46L29 34Z" fill="${hc}"/>`;
    if (f.front === 'bangs') s += `<path d="M24 50Q18 14 50 12Q82 14 76 50L72 34Q66 40 60 30Q56 40 50 28Q44 40 40 30Q34 40 28 34Z" fill="${hc}"/>`;
    if (f.front === 'swoop') s += `<path d="M24 50Q18 12 52 11Q84 14 76 50Q74 36 64 32Q46 38 30 30Q27 38 24 50Z" fill="${hc}"/>`;
  }
  s += (COS.over || '');
  return s + '</g></svg>';
}
