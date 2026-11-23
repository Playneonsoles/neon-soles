import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createBurnCheckedInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { type Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { ApiError, api } from "./api";
import { loadLocalKeypair } from "./localWallet";

const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const programOf = (k?: string) => (k === "token-2022" ? TOKEN_2022 : TOKEN_PROGRAM_ID);
const memoIx = (text: string) => new TransactionInstruction({ programId: MEMO, keys: [], data: new TextEncoder().encode(text) as unknown as Buffer });

export interface MarketQuote { token_program?: string; payer: string; mint: string; decimals: number; treasury: string; seller_wallet: string; amount_base: string; fee_lamports: string; memo: string }
export interface ShopQuote { token_program?: string; payer: string; mint: string; decimals: number; memo: string; burn_base: string; transfers: { owner: string; amount_base: string }[] }

/** Achat sur la place de marché : $WALK au vendeur + frais en SOL à la trésorerie, dans UNE transaction signée par l'acheteur. */
export function marketIxs(q: MarketQuote) {
  const buyer = new PublicKey(q.payer), mint = new PublicKey(q.mint), seller = new PublicKey(q.seller_wallet), prog = programOf(q.token_program);
  const from = getAssociatedTokenAddressSync(mint, buyer, false, prog), to = getAssociatedTokenAddressSync(mint, seller, true, prog);
  return [
    createAssociatedTokenAccountIdempotentInstruction(buyer, to, seller, mint, prog),
    createTransferCheckedInstruction(from, mint, to, buyer, BigInt(q.amount_base), q.decimals, [], prog),
    SystemProgram.transfer({ fromPubkey: buyer, toPubkey: new PublicKey(q.treasury), lamports: BigInt(q.fee_lamports) }),
    memoIx(q.memo),
  ];
}

/** Achat en boutique : une part brûlée, le reste au pool et à la trésorerie. */
export function shopIxs(q: ShopQuote) {
  const buyer = new PublicKey(q.payer), mint = new PublicKey(q.mint), prog = programOf(q.token_program);
  const from = getAssociatedTokenAddressSync(mint, buyer, false, prog);
  const ixs = [createBurnCheckedInstruction(from, mint, buyer, BigInt(q.burn_base), q.decimals, [], prog)];
  for (const t of q.transfers) {
    const owner = new PublicKey(t.owner), to = getAssociatedTokenAddressSync(mint, owner, true, prog);
    ixs.push(createAssociatedTokenAccountIdempotentInstruction(buyer, to, owner, mint, prog), createTransferCheckedInstruction(from, mint, to, buyer, BigInt(t.amount_base), q.decimals, [], prog));
  }
  ixs.push(memoIx(q.memo));
  return ixs;
}

export interface ForgeQuote extends ShopQuote { treasury: string; sol_lamports: string }

/** Forge : comme la boutique (brûlage + pool + trésorerie en $WALK) plus un paiement en SOL à la trésorerie, dans UNE transaction. */
export function forgeIxs(q: ForgeQuote) {
  const ixs = shopIxs(q);
  const memo = ixs.pop()!;
  ixs.push(SystemProgram.transfer({ fromPubkey: new PublicKey(q.payer), toPubkey: new PublicKey(q.treasury), lamports: BigInt(q.sol_lamports) }), memo);
  return ixs;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Signe et envoie la transaction, attend sa finalisation, puis demande au serveur de la vérifier (il relit la blockchain lui-même). */
export async function payAndConfirm(o: { wallet: WalletContextState; connection: Connection; ixs: TransactionInstruction[]; confirmPath: string; expectedPayer: string }) {
  const { wallet, connection } = o;
  // Joueur connecté par email/Google : la clé locale (générée dans son navigateur) signe ; sinon le wallet connecté.
  const local = wallet.publicKey ? null : loadLocalKeypair();
  const payer = wallet.publicKey ?? local?.publicKey;
  if (!payer) throw new ApiError(0, "Connect your wallet.", "pay_connect");
  if (payer.toBase58() !== o.expectedPayer) throw new ApiError(0, local ? "The key saved in this browser is not the one of your account. Import your secret key first." : "The connected wallet is not the one of your account.", local ? "pay_wrong_key" : "pay_wrong_wallet");
  const tx = new Transaction().add(...o.ixs);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash; tx.feePayer = payer;
  let signature: string;
  if (local) { tx.sign(local); signature = await connection.sendRawTransaction(tx.serialize()); }
  else signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "finalized");
  for (let i = 0; i < 12; i++) {
    try { return await api<{ ok: boolean }>(o.confirmPath, { body: { signature } }); }
    catch (e) {
      if (e instanceof ApiError && e.status === 402) { await sleep(3000); continue; } // pas encore vu comme finalisé par le serveur
      throw e;
    }
  }
  throw new ApiError(0, "Payment sent but not verified yet. Do not pay again: try again in a minute.", "pay_not_verified");
}
