import type { FastifyRequest } from "fastify";

/** Adresse du visiteur : CF-Connecting-IP derrière Cloudflare (si activé), sinon l'IP vue par le proxy de confiance. */
export function clientIp(req: FastifyRequest, behindCloudflare: boolean): string {
  if (behindCloudflare) {
    const h = req.headers["cf-connecting-ip"];
    const v = Array.isArray(h) ? h[0] : h;
    if (v && v.length <= 45) return v;
  }
  return req.ip;
}
