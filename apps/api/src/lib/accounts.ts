import { Prisma, prisma } from "@walk/db";

/**
 * Retourne le compte du wallet, en le créant avec sa chaussure de départ gratuite (niveau 1)
 * (jeu sans NFT : simple ligne en base). Répare aussi un compte existant resté sans chaussure.
 */
export async function ensureUserWithShoe(o: { wallet: string; walletKind: string; isAdmin: boolean }) {
  const give = async (tx: Prisma.TransactionClient, userId: string) => {
    if ((await tx.shoes.count({ where: { owner_id: userId, removed_at: null } })) > 0) return;
    await tx.shoes.create({ data: { owner_id: userId, model: "starter", source: "starter" } });
  };
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.users.findUnique({ where: { wallet: o.wallet } });
      const user = existing
        ? await tx.users.update({ where: { id: existing.id }, data: { is_admin: o.isAdmin } })
        : await tx.users.create({ data: { wallet: o.wallet, wallet_kind: o.walletKind, is_admin: o.isAdmin } });
      await give(tx, user.id);
      return { ...user, created: !existing };
    });
  } catch (e) {
    // Deux connexions simultanées : l'autre a créé le compte, on relit.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ...(await prisma.users.findUniqueOrThrow({ where: { wallet: o.wallet } })), created: false };
    }
    throw e;
  }
}
