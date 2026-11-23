/** Badges d'équipe et de communauté, donnés à la main par un administrateur (non échangeables, jamais vendus). */
export interface BadgeDef { code: string; icon: string; color: string; name: string }

export const BADGES: readonly BadgeDef[] = [
  { code: "team", icon: "🛠️", color: "#39FF88", name: "Team member" },
  { code: "investor", icon: "💎", color: "#67E8F9", name: "Investor" },
  { code: "og", icon: "👑", color: "#FBBF24", name: "OG" },
  { code: "early_tester", icon: "🧪", color: "#A78BFA", name: "Early tester" },
  { code: "ambassador", icon: "📣", color: "#F472B6", name: "Ambassador" },
  { code: "moderator", icon: "🛡️", color: "#60A5FA", name: "Moderator" },
  { code: "creator", icon: "🎬", color: "#FB923C", name: "Content creator" },
  { code: "partner", icon: "🤝", color: "#34D399", name: "Partner" },
  { code: "vip", icon: "⭐", color: "#FDE047", name: "VIP" },
  { code: "bug_hunter", icon: "🐞", color: "#F87171", name: "Bug hunter" },
] as const;

export const BADGE_CODES = BADGES.map((b) => b.code);
export const badgeByCode = (code: string) => BADGES.find((b) => b.code === code);
