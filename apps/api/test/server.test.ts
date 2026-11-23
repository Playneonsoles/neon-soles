import { beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../src/env";
import { buildServer } from "../src/server";

const env = loadEnv({
  NODE_ENV: "test", APP_DOMAIN: "walk.test", APP_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://x:x@localhost:5432/x", JWT_SECRET: "x".repeat(32),
} as NodeJS.ProcessEnv);

describe("API (sans base de données)", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  beforeAll(async () => { app = await buildServer(env); });

  it("répond sur /health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
  });
  it("refuse /me sans session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/me" });
    expect(res.statusCode).toBe(401);
  });
  it("refuse un nonce pour une adresse invalide", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/auth/nonce", payload: { wallet: "0xabc" } });
    expect(res.statusCode).toBe(400);
  });
  it("refuse une vérification mal formée", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/auth/verify", payload: {} });
    expect(res.statusCode).toBe(400);
  });
  it("protège les routes de marche et de chaussures", async () => {
    for (const [method, url] of [["POST", "/api/v1/walk/start"], ["GET", "/api/v1/walk/history"], ["GET", "/api/v1/shoes"]] as const) {
      expect((await app.inject({ method, url })).statusCode).toBe(401);
    }
  });
  it("limite l'authentification à 10 requêtes/min", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (await app.inject({ method: "POST", url: "/api/v1/auth/nonce", payload: { wallet: "x" } })).statusCode;
    }
    expect(last).toBe(429);
  });
});
