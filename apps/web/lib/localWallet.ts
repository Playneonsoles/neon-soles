import { Keypair } from "@solana/web3.js";

/**
 * Portefeuille local des joueurs connectés par email / Google.
 * La clé est générée DANS le navigateur ; le serveur ne reçoit que l'adresse publique.
 * Elle est gardée dans le stockage du navigateur pour signer les achats ; le joueur doit en faire une sauvegarde.
 */
const KEY = "ns_local_key";
const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function b58encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) { s = ALPHA[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = "1" + s; else break; }
  return s;
}
export function b58decode(str: string): Uint8Array {
  let n = 0n;
  for (const c of str.trim()) { const i = ALPHA.indexOf(c); if (i < 0) throw new Error("bad key"); n = n * 58n + BigInt(i); }
  const out: number[] = [];
  while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
  for (const c of str.trim()) { if (c === "1") out.unshift(0); else break; }
  return Uint8Array.from(out);
}

export const newLocalKeypair = () => Keypair.generate();
/** Clé secrète au format Phantom (base58 de 64 octets). */
export const secretToString = (kp: Keypair) => b58encode(kp.secretKey);
/** Même clé au format fichier Solana CLI (tableau JSON). */
export const secretToJson = (kp: Keypair) => JSON.stringify(Array.from(kp.secretKey));

export function saveLocalKeypair(kp: Keypair) { try { localStorage.setItem(KEY, secretToString(kp)); } catch { /* stockage bloqué */ } }
export function loadLocalKeypair(): Keypair | null {
  try { const v = localStorage.getItem(KEY); return v ? Keypair.fromSecretKey(b58decode(v)) : null; } catch { return null; }
}
/** Supprime la clé de ce navigateur (le joueur doit l'avoir sauvegardée). */
export function clearLocalKeypair() { try { localStorage.removeItem(KEY); } catch { /* stockage bloqué */ } }
/** Importe une clé collée (base58) ou un fichier JSON [..64 nombres..]. */
export function parseSecret(text: string): Keypair {
  const t = text.trim();
  return Keypair.fromSecretKey(t.startsWith("[") ? Uint8Array.from(JSON.parse(t) as number[]) : b58decode(t));
}
