import { randomBytes } from "node:crypto";
import { Connection, PublicKey } from "@solana/web3.js";
import { type ExpectedPayment, type PaymentCheck, type ParsedTxLike, type TokenProgramKind, tokenProgramAddress, verifyPayment } from "@walk/solana";
import type { Env } from "../env";

const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

export const ata = (mint: string, owner: string, program: TokenProgramKind = "spl-token") =>
  PublicKey.findProgramAddressSync([new PublicKey(owner).toBuffer(), new PublicKey(tokenProgramAddress(program)).toBuffer(), new PublicKey(mint).toBuffer()], ATA_PROGRAM)[0].toBase58();

export const newNonce = () => randomBytes(12).toString("hex");

/** Paramètres on-chain du jeu, ou null s'ils ne sont pas encore fournis (adresses publiques seulement). */
export function chainParams(env: Env) {
  if (!env.SOLANA_RPC_URL || !env.WALK_MINT || !env.TREASURY_WALLET) return null;
  return { rpc: env.SOLANA_RPC_URL, mint: env.WALK_MINT, treasury: env.TREASURY_WALLET, pool: env.POOL_WALLET ?? env.TREASURY_WALLET, decimals: env.WALK_DECIMALS, tokenProgram: env.WALK_TOKEN_PROGRAM };
}

/** Relit la transaction sur la blockchain (finalisée) et la compare à ce qui était attendu. */
export async function checkPayment(rpc: string, signature: string, expected: ExpectedPayment): Promise<PaymentCheck> {
  const conn = new Connection(rpc, "finalized");
  const tx = await conn.getParsedTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
  return verifyPayment(tx as unknown as ParsedTxLike | null, expected);
}
