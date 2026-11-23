/** Jeton Cloudflare Turnstile (anti-robots, gratuit, quasi invisible). Retourne undefined si Turnstile n'est pas configuré. */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface TurnstileApi {
  render(el: HTMLElement, o: { sitekey: string; appearance: string; callback: (t: string) => void; "error-callback": () => void }): string;
  remove(id: string): void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile_load"));
    document.head.appendChild(s);
  });
}

export async function getTurnstileToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;
  await loadScript();
  return new Promise((resolve, reject) => {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:9999";
    document.body.appendChild(box);
    const done = (fn: () => void) => { try { if (id) window.turnstile?.remove(id); } catch { /* ignoré */ } box.remove(); fn(); };
    const id = window.turnstile!.render(box, {
      sitekey: SITE_KEY, appearance: "interaction-only", // visible seulement si Cloudflare doute
      callback: (t) => done(() => resolve(t)),
      "error-callback": () => done(() => reject(new Error("turnstile"))),
    });
  });
}
