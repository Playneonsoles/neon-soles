const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Défense en profondeur contre le CSRF (en plus de SameSite=Strict) : une requête qui modifie des données
 * et qui porte un en-tête Origin doit venir de notre site. Sans Origin (curl, serveur), le cookie
 * SameSite=Strict ne part de toute façon pas depuis un autre site.
 */
export function isOriginAllowed(method: string, origin: string | undefined, allowed: string): boolean {
  if (!UNSAFE.has(method.toUpperCase())) return true;
  if (origin === undefined) return true;
  return origin === allowed;
}
