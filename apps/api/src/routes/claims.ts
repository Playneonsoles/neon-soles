import { claimableOf, createClaim, prisma } from "@walk/db";
import type { FastifyInstance } from "fastify";
import { getConfigs } from "../lib/config";

export async function claimRoutes(app: FastifyInstance) {
  // Retrait des $WALK confirmés vers le wallet Solana du joueur (pour les vendre sur une plateforme d'échange, par exemple).
  app.post("/claims", { preHandler: app.authenticate, config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { game } = await getConfigs();
    const r = await createClaim(prisma, req.user.sub, game, app.env.WALK_DECIMALS);
    if (r.ok) return { id: r.claim.id, amount: r.claim.amount, fee: r.claim.fee, net: r.claim.net, status: "queued" };
    const msg = {
      paused: "Withdrawals are temporarily paused.",
      below_min: `Minimum withdrawal: ${game.claim_min} $WALK.`,
      too_soon: "Only one withdrawal per 24 h: try again later.",
      banned: "Account suspended.",
      too_new: `Account too new: withdrawals open after ${game.claim_min_account_age_hours} h and ${game.claim_min_valid_walks} valid walks.`,
    }[r.reason];
    return reply.code(r.reason === "banned" ? 403 : 409).send({ error: r.reason, message: msg, next_at: r.nextAt ?? null, params: { min: game.claim_min, hours: game.claim_min_account_age_hours, walks: game.claim_min_valid_walks } });
  });

  app.get("/claims", { preHandler: app.authenticate }, async (req) => {
    const rows = await prisma.claims.findMany({ where: { user_id: req.user.sub }, orderBy: { created_at: "desc" }, take: 20 });
    return {
      claimable: (await claimableOf(prisma, req.user.sub)).toString(),
      claims: rows.map((c) => ({
        id: c.id, status: c.status, amount: c.amount.toFixed(0), fee: c.fee.toFixed(0), net: c.amount.sub(c.fee).toFixed(0),
        tx_signature: c.tx_signature, created_at: c.created_at,
      })),
    };
  });
}
