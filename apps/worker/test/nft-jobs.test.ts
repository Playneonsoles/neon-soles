import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env";

const base = {
  REDIS_URL: "redis://x", APP_ORIGIN: "https://walk.test", SOLANA_RPC_URL: "https://api.devnet.solana.com",
  MINTER_SECRET_KEY_FILE: "/run/secrets/minter", SHOE_COLLECTION: "x".repeat(44), NFT_BASE_URL: "https://nft.walk.test",
  S3_BUCKET_NFT: "nft", S3_ACCESS_KEY: "a", S3_SECRET_KEY: "b",
};
describe("configuration du worker", () => {
  it("accepte une configuration complète et applique les défauts", () => {
    const e = loadEnv(base as NodeJS.ProcessEnv);
    expect(e.WALK_DECIMALS).toBe(6);
    expect(e.S3_REGION).toBe("fr-par");
  });
  it("refuse une collection manquante (lancer create-collections d'abord)", () => {
    const { SHOE_COLLECTION: _, ...rest } = base;
    expect(() => loadEnv(rest as NodeJS.ProcessEnv)).toThrow();
  });
});
