/** Le jeton peut vivre sur le programme SPL classique ou sur Token-2022 (certains jetons pump.fun). Réglé par WALK_TOKEN_PROGRAM. */
export type TokenProgramKind = "spl-token" | "token-2022";
export const TOKEN_PROGRAM_IDS: Record<TokenProgramKind, string> = {
  "spl-token": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "token-2022": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
};
/** Adresse (texte) du programme du jeton ; l'appelant la convertit en PublicKey. Aucune dépendance Solana ici. */
export const tokenProgramAddress = (kind: TokenProgramKind | string | undefined): string =>
  TOKEN_PROGRAM_IDS[kind === "token-2022" ? "token-2022" : "spl-token"];
