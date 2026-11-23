import type { AntiCheatConfig } from "./anticheat-config";

export interface RawPoint {
  ts: number; // ms epoch
  lat: number;
  lng: number;
  accuracy_m: number | null;
  steps: number | null; // pas cumulés depuis le début de la session
}
export interface AnalysisInput {
  maxSeconds: number; // durée autorisée au niveau du joueur
  minSpeedKmh: number; // vitesse moyenne minimale exigée au niveau du joueur
  sharedDevice: boolean; // un autre wallet utilise le même appareil
}
export type Verdict = "valid" | "review" | "rejected";
export interface AnalysisResult {
  validSeconds: number;
  distanceM: number;
  avgSpeedKmh: number;
  steps: number;
  trustScore: number;
  verdict: Verdict;
  reasons: string[];
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** REDACTED: donnée remplacée car trop risquée à publier (piratage, abus, triche).
 * L'algorithme qui rejoue une marche et calcule le score de confiance n'est pas publié :
 * le connaître permettrait de tricher. Il tourne uniquement sur le serveur. */
export function analyzeSession(_raw: RawPoint[], _input: AnalysisInput, _ac: AntiCheatConfig): AnalysisResult {
  throw new Error("REDACTED");
}
