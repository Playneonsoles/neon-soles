/** Vérifie un jeton Cloudflare Turnstile côté serveur. Retourne true si valide. */
export async function verifyTurnstile(secret: string, token: string | undefined, ip: string): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // en cas de doute, on refuse
  }
}
