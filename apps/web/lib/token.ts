/** Adresses PUBLIQUES du jeton $WALK. Réglables par variables d'environnement, avec le jeton actuel par défaut. */
export const WALK_MINT = process.env.NEXT_PUBLIC_WALK_MINT || "7nq4eLwu14zhJhB9PSEzjTMxXcTguBV4uw5kMsnupump";
export const BUY_URL = process.env.NEXT_PUBLIC_BUY_URL || `https://pump.fun/coin/${WALK_MINT}`;
export const SOLSCAN_URL = `https://solscan.io/token/${WALK_MINT}`;
export const CHART_URL = process.env.NEXT_PUBLIC_CHART_URL || `https://gmgn.ai/sol/token/${WALK_MINT}`;
