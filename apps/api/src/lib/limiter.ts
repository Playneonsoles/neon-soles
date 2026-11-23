/** Compteur par clé sur une fenêtre glissante, en mémoire (une seule instance d'API). Sert à plafonner les créations de comptes. */
export class WindowLimiter {
  private hits = new Map<string, number[]>();
  constructor(private windowMs: number) {
    setInterval(() => this.sweep(), 10 * 60_000).unref();
  }
  /** Retourne true si l'action est autorisée (et la compte), false si le plafond est atteint. */
  take(key: string, max: number, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= max) { this.hits.set(key, recent); return false; }
    recent.push(now); this.hits.set(key, recent); return true;
  }
  private sweep(now = Date.now()) {
    for (const [k, v] of this.hits) { const r = v.filter((t) => now - t < this.windowMs); if (r.length) this.hits.set(k, r); else this.hits.delete(k); }
  }
}
