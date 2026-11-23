import { describe, expect, it } from "vitest";
import { MARKET_FEE_FLOOR_LAMPORTS, listingPriceError, marketFeeLamports } from "../src/market";

const base = { market_fee_min_sol: 0.01, market_fee_lamports_per_walk: 0, market_min_price_walk: 10, market_max_price_walk: 1_000_000 };

describe("place de marché : frais en SOL", () => {
  it("frais fixes de 0,01 SOL par défaut", () => {
    expect(marketFeeLamports(500, base)).toBe(10_000_000n);
  });
  it("jamais en dessous de 0,01 SOL, même si l'admin règle moins", () => {
    expect(marketFeeLamports(500, { ...base, market_fee_min_sol: 0.001 })).toBe(MARKET_FEE_FLOOR_LAMPORTS);
  });
  it("monte avec le prix quand un taux proportionnel est réglé", () => {
    const c = { ...base, market_fee_lamports_per_walk: 100_000 };
    expect(marketFeeLamports(50, c)).toBe(10_000_000n);     // 5 M < minimum
    expect(marketFeeLamports(1000, c)).toBe(100_000_000n);  // 0,1 SOL
  });
  it("valide le prix", () => {
    expect(listingPriceError(100, base)).toBeNull();
    expect(listingPriceError(5, base)).not.toBeNull();
    expect(listingPriceError(2_000_000, base)).not.toBeNull();
    expect(listingPriceError(10.5, base)).not.toBeNull();
  });
});

import { shoeShopPrice } from "../src/market";
describe("boutique de chaussures", () => {
  const cfg = { shoe_shop_enabled: true, shoe_shop_prices: { "2": 30_000, "3": 61_000, "4": 124_000, "5": 250_000 } };
  it("vend les niveaux 2 à 5 au prix réglé, pas les autres", () => {
    expect(shoeShopPrice(2, cfg)).toBe(30_000);
    expect(shoeShopPrice(5, cfg)).toBe(250_000);
    expect(shoeShopPrice(1, cfg)).toBeNull();
    expect(shoeShopPrice(6, cfg)).toBeNull();
  });
  it("rien n'est vendu si la boutique est coupée", () => expect(shoeShopPrice(3, { ...cfg, shoe_shop_enabled: false })).toBeNull());
});
