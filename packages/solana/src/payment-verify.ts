/**
 * Vérification d'un paiement à partir d'une transaction « jsonParsed » du RPC. Fonction pure (aucun appel réseau) :
 * l'API lui donne la transaction finalisée et ce qu'elle attend. Sert à la place de marché (vendeur + frais SOL)
 * et à la boutique de chaussures (pool + trésorerie + brûlage).
 */
export interface ParsedInstruction { program?: string; programId?: string; parsed?: unknown }
export interface ParsedTxLike {
  meta: { err: unknown } | null;
  transaction: { message: { instructions: ParsedInstruction[] } };
}
export interface ExpectedPayment {
  payer: string;
  mint: string;
  /** Transferts de jeton attendus (compte de jeton de destination + montant exact en unités de base). */
  transfers: { destinationAta: string; amountBase: bigint }[];
  /** Montant à brûler (burnChecked), exact ; absent = pas de brûlage. */
  burnBase?: bigint;
  /** Frais en SOL à verser à une adresse, au moins `minLamports`. */
  sol?: { destination: string; minLamports: bigint };
  /** Référence unique de la commande (mémo), pour qu'un paiement ne serve qu'une fois et pour la bonne commande. */
  memo: string;
}
export type PaymentCheck = { ok: true } | { ok: false; reason: string };

const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);

export function verifyPayment(tx: ParsedTxLike | null, e: ExpectedPayment): PaymentCheck {
  if (!tx) return { ok: false, reason: "Transaction not found (not finalized yet?)." };
  if (tx.meta === null || tx.meta.err !== null) return { ok: false, reason: "The transaction failed on the blockchain." };

  const remaining = e.transfers.map((t) => ({ ...t, done: false }));
  let burn = e.burnBase === undefined, fee = e.sol === undefined, memo = false;

  for (const ix of tx.transaction.message.instructions) {
    const p = rec(ix.parsed);
    const i = rec(p?.info);
    const isToken = ix.program === "spl-token" || ix.program === "spl-token-2022";
    if (isToken && p?.type === "transferChecked") {
      const amt = rec(i?.tokenAmount);
      if (i?.authority !== e.payer || i?.mint !== e.mint) continue;
      const m = remaining.find((t) => !t.done && t.destinationAta === i?.destination && amt?.amount === t.amountBase.toString());
      if (m) m.done = true;
    } else if (isToken && p?.type === "burnChecked") {
      const amt = rec(i?.tokenAmount);
      if (i?.authority === e.payer && i?.mint === e.mint && e.burnBase !== undefined && amt?.amount === e.burnBase.toString()) burn = true;
    } else if (ix.program === "system" && p?.type === "transfer" && e.sol) {
      if (i?.source === e.payer && i?.destination === e.sol.destination && typeof i?.lamports === "number" && BigInt(i.lamports) >= e.sol.minLamports) fee = true;
    } else if (ix.program === "spl-memo" && ix.parsed === e.memo) {
      memo = true;
    }
  }
  if (remaining.some((t) => !t.done)) return { ok: false, reason: "A $WALK transfer is missing or incorrect." };
  if (!burn) return { ok: false, reason: "The $WALK burn is missing or incorrect." };
  if (!fee) return { ok: false, reason: "The SOL fee is missing or too low." };
  if (!memo) return { ok: false, reason: "Order reference missing." };
  return { ok: true };
}
