import { prisma } from "@walk/db";
import type { FastifyRequest } from "fastify";

export type Device = "android" | "iphone" | "computer" | "other";

/** Type d'appareil déduit du User-Agent (on ne garde pas le User-Agent lui-même). */
export function deviceOf(ua: string | undefined): Device {
  const s = (ua ?? "").toLowerCase();
  if (s.includes("android")) return "android";
  if (/iphone|ipad|ipod/.test(s)) return "iphone";
  if (/windows|macintosh|linux|cros/.test(s)) return "computer";
  return "other";
}

/**
 * Pays déduit d'un en-tête posé par le proxy (Cloudflare : CF-IPCountry). Sans proxy compatible, le pays reste vide.
 * L'adresse IP n'est jamais lue ici ni enregistrée.
 */
export function countryOf(req: FastifyRequest): string | null {
  const raw = req.headers["cf-ipcountry"];
  const c = (Array.isArray(raw) ? raw[0] : raw)?.toUpperCase();
  return c && /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : null;
}

/** Enregistre une connexion réussie. Une erreur ici ne doit jamais empêcher le joueur de se connecter. */
export async function recordLogin(req: FastifyRequest, o: { userId: string; isNew: boolean; mode: "app" | "browser" }) {
  try {
    await prisma.$transaction([
      prisma.login_events.create({
        data: { user_id: o.userId, country: countryOf(req), device: deviceOf(req.headers["user-agent"]), mode: o.mode, is_new: o.isNew },
      }),
      prisma.users.update({ where: { id: o.userId }, data: { last_seen_at: new Date() } }),
    ]);
  } catch (e) {
    req.log.warn({ err: e }, "login event not recorded");
  }
}
