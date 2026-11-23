import { readFileSync } from "node:fs";
import bs58 from "bs58";

/**
 * Charge une clé secrète Solana depuis un fichier monté (JSON [..64 octets..] ou base58).
 * Jamais depuis le dépôt Git. Le branchement direct sur Scaleway Secret Manager est prévu au lot 7.
 */
export function loadSecretKey(path: string): Uint8Array {
  const txt = readFileSync(path, "utf8").trim();
  const bytes = txt.startsWith("[") ? Uint8Array.from(JSON.parse(txt) as number[]) : bs58.decode(txt);
  if (bytes.length !== 64) throw new Error("Invalid secret key: 64 bytes expected");
  return bytes;
}
