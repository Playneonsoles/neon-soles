/**
 * Monuments : texte court tiré de Wikipédia (API publique REST, gratuite, sans clé, texte sous licence CC BY-SA).
 * Le texte n'est demandé que si le joueur choisit de lire l'alerte, dans sa langue si la page existe dans cette langue.
 */
export interface LandmarkInfo { title: string; text: string; url: string | null; image: string | null }

const cache = new Map<string, LandmarkInfo | null>();

/** Coupe proprement le résumé à une ou deux phrases (environ 320 caractères). */
function shorten(text: string, max = 340): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > 120 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

async function summary(lang: string, title: string, signal?: AbortSignal): Promise<LandmarkInfo | null> {
  const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`, { signal, headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const j = (await r.json()) as { title?: string; extract?: string; content_urls?: { desktop?: { page?: string } }; thumbnail?: { source?: string }; type?: string };
  if (!j.extract || j.type === "disambiguation") return null;
  return { title: j.title ?? title, text: shorten(j.extract), url: j.content_urls?.desktop?.page ?? null, image: j.thumbnail?.source ?? null };
}

/** `wiki` est l'étiquette OpenStreetMap, par exemple « fr:Tour Eiffel ». `locale` : langue du site (fr, en, es, pt, it, zh…). */
export async function loadLandmark(wiki: string, locale: string, signal?: AbortSignal): Promise<LandmarkInfo | null> {
  const key = `${locale}|${wiki}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const i = wiki.indexOf(":");
  const lang = wiki.slice(0, i), title = wiki.slice(i + 1);
  const want = locale.slice(0, 2).toLowerCase();
  let info: LandmarkInfo | null = null;
  try {
    if (want !== lang) {
      // La même page dans la langue du joueur, si elle existe (liens entre langues de Wikipédia).
      const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=langlinks&lllang=${want}&titles=${encodeURIComponent(title)}&redirects=1`, { signal });
      const j = (await r.json()) as { query?: { pages?: Record<string, { langlinks?: { "*"?: string }[] }> } };
      const other = Object.values(j.query?.pages ?? {})[0]?.langlinks?.[0]?.["*"];
      if (other) info = await summary(want, other, signal);
    }
    info ??= await summary(lang, title, signal);
  } catch { info = null; }
  cache.set(key, info);
  return info;
}
