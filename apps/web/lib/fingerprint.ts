/** Empreinte d'appareil (SHA-256) : sert à repérer plusieurs wallets sur le même téléphone. */
export async function deviceHash(): Promise<string | undefined> {
  try {
    const raw = [navigator.userAgent, navigator.language, screen.width, screen.height, screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.hardwareConcurrency, navigator.platform].join("|");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}
