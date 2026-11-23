import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MAX_CLAIM_ATTEMPTS, RESEND_AFTER_MS } from "@walk/game";
import { Prisma, failClaim, prisma, settleClaim } from "@walk/db";
import { tokenProgramAddress } from "@walk/solana";

const tokenProgramId = (kind: string | undefined) => new PublicKey(tokenProgramAddress(kind));
import bs58 from "bs58";
import type { WorkerEnv } from "./env";

const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export interface Payer { conn: Connection; key: Keypair; mint: PublicKey; env: WorkerEnv }

/** Prépare, signe et envoie le virement ; la signature est enregistrée AVANT l'envoi pour pouvoir retrouver la transaction. */
async function send(p: Payer, c: { id: string; userWallet: string; net: bigint; attempts: number }) {
  const owner = new PublicKey(c.userWallet);
  const prog = tokenProgramId(p.env.WALK_TOKEN_PROGRAM);
  const from = getAssociatedTokenAddressSync(p.mint, p.key.publicKey, false, prog);
  const to = getAssociatedTokenAddressSync(p.mint, owner, true, prog);
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(p.key.publicKey, to, owner, p.mint, prog),
    createTransferCheckedInstruction(from, p.mint, to, p.key.publicKey, c.net, p.env.WALK_DECIMALS, [], prog),
    new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from(`walk:claim:${c.id}`) }),
  );
  const { blockhash } = await p.conn.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash; tx.feePayer = p.key.publicKey; tx.sign(p.key);
  const raw = tx.signatures[0]?.signature;
  if (!raw) throw new Error("Signature absente");
  const signature = bs58.encode(raw);
  await prisma.claims.update({ where: { id: c.id }, data: { status: "sent", tx_signature: signature, sent_at: new Date(), attempts: c.attempts + 1 } });
  await p.conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
}

/**
 * Toutes les 30 s : envoie les claims en file, confirme ceux envoyés, renvoie ceux restés sans trace après 3 minutes
 * (l'ancienne transaction ne peut plus aboutir : sa blockhash a expiré). Une ligne est traitée par un seul passage (SKIP LOCKED).
 */
export async function processClaims(p: Payer): Promise<number> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM claims WHERE status IN ('queued', 'sent') ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED`;
  let n = 0;
  for (const { id } of rows) {
    const c = await prisma.claims.findUnique({ where: { id } });
    if (!c) continue;
    const user = await prisma.users.findUnique({ where: { id: c.user_id }, select: { wallet: true, status: true } });
    if (!user) continue;
    const net = BigInt(c.amount.toFixed(0)) - BigInt(c.fee.toFixed(0));
    const attempts = c.attempts ?? 0;
    try {
      if (c.status === "sent" && c.tx_signature) {
        const st = (await p.conn.getSignatureStatuses([c.tx_signature], { searchTransactionHistory: true })).value[0];
        if (st && !st.err && (st.confirmationStatus === "finalized")) { await settleClaim(prisma, c.id, c.tx_signature); n++; continue; }
        if (st?.err) { await failClaim(prisma, c.id); n++; continue; }     // refusée par la blockchain : le montant est rendu
        if (st) continue;                                                    // en cours de finalisation
        if (!c.sent_at || Date.now() - c.sent_at.getTime() < RESEND_AFTER_MS) continue;
        if (attempts >= MAX_CLAIM_ATTEMPTS) { await failClaim(prisma, c.id); console.error(`[claims] ${c.id} abandonné après ${attempts} essais`); n++; continue; }
      }
      if (net <= 0n) { await failClaim(prisma, c.id); continue; }
      await send(p, { id: c.id, userWallet: user.wallet, net, attempts });
      n++;
    } catch (e) {
      console.error(`[claims] ${c.id} :`, e instanceof Error ? e.message : e);
    }
  }
  return n;
}

/** Solde du portefeuille de récompenses (unités de base), pour l'alerte de réserve. */
export async function rewardBalance(p: Payer): Promise<bigint> {
  try {
    const r = await p.conn.getTokenAccountBalance(getAssociatedTokenAddressSync(p.mint, p.key.publicKey, false, tokenProgramId(p.env.WALK_TOKEN_PROGRAM)), "finalized");
    return BigInt(r.value.amount);
  } catch { return 0n; }
}
export type { Prisma };
