import bs58 from "bs58";
import nacl from "tweetnacl";

export interface SignInFields {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string; // ISO 8601
}

/**
 * Message signé par le joueur, au format exact « Sign-In With Solana » (SIWS).
 * Phantom et Solflare lisent ce format de façon STRICTE : si un champ manque ou si la casse diffère,
 * le wallet refuse d'afficher la demande (« invalid formatting »). Ne rien changer à l'ordre ni aux libellés.
 */
export function buildSignInMessage(f: SignInFields): string {
  return [
    `${f.domain} wants you to sign in with your Solana account:`,
    f.address,
    "",
    "Sign in to Neon Soles. No transaction, no fee.",
    "",
    `URI: https://${f.domain}`,
    "Version: 1",
    "Chain ID: mainnet",
    `Nonce: ${f.nonce}`,
    `Issued At: ${f.issuedAt}`,
  ].join("\n");
}

/** Une adresse Solana valide = base58 décodant en 32 octets. */
export function isValidSolanaAddress(address: string): boolean {
  if (address.length < 32 || address.length > 44) return false;
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}

/** Vérifie la signature ed25519 (détachée, base64) du message avec la clé publique du wallet. */
export function verifyWalletSignature(message: string, signatureB64: string, address: string): boolean {
  try {
    if (!isValidSolanaAddress(address)) return false;
    const sig = Buffer.from(signatureB64, "base64");
    if (sig.length !== nacl.sign.signatureLength) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, bs58.decode(address));
  } catch {
    return false;
  }
}
