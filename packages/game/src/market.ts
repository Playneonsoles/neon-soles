import type { GameConfig } from "./config";

type C = Pick<GameConfig, "market_fee_min_sol" | "market_fee_lamports_per_walk" | "market_min_price_walk" | "market_max_price_walk">;

export const LAMPORTS_PER_SOL = 1_000_000_000n;
/** Minimum absolu des frais, quoi qu'on règle dans l'admin : 0,01 SOL. */
export const MARKET_FEE_FLOOR_LAMPORTS = 10_000_000n;

export const solToLamports = (sol: number): bigint => BigInt(Math.round(sol * 1e9));

/**
 * Frais de la place de marché, payés en SOL par l'acheteur à la trésorerie : le plus grand entre le minimum réglé (≥ 0,01 SOL)
 * et un montant proportionnel au prix (lamports par $WALK, 0 = frais fixes). Le prix, lui, va entier au vendeur en $WALK.
 */
export function marketFeeLamports(priceWalk: number, c: C): bigint {
  const min = solToLamports(c.market_fee_min_sol);
  const prop = BigInt(c.market_fee_lamports_per_walk) * BigInt(priceWalk);
  const fee = min > prop ? min : prop;
  return fee < MARKET_FEE_FLOOR_LAMPORTS ? MARKET_FEE_FLOOR_LAMPORTS : fee;
}

/** Message d'erreur si le prix demandé n'est pas acceptable (entier de $WALK dans la fourchette réglée), sinon null. */
export function listingPriceError(priceWalk: number, c: C): string | null {
  if (!Number.isSafeInteger(priceWalk)) return "The price must be a whole number of $WALK.";
  if (priceWalk < c.market_min_price_walk) return `Prix minimum : ${c.market_min_price_walk} $WALK.`;
  if (priceWalk > c.market_max_price_walk) return `Prix maximum : ${c.market_max_price_walk} $WALK.`;
  return null;
}

/** Prix d'achat direct d'une chaussure de ce niveau, en $WALK entiers ; null = pas vendue par le jeu (place de marché seulement). */
export function shoeShopPrice(level: number, c: Pick<GameConfig, "shoe_shop_enabled" | "shoe_shop_prices">): number | null {
  if (!c.shoe_shop_enabled) return null;
  const p = c.shoe_shop_prices[String(level)];
  return p === undefined ? null : p;
}
