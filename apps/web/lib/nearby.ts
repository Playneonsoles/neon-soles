"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Données autour du joueur : routes, chemins, parcs, eaux et petits lieux, issus d'OpenStreetMap (données ouvertes, via l'API Overpass).
 * Appel limité : seulement quand le joueur s'est éloigné de 100 m du dernier point chargé, et au plus une fois par minute.
 * Si le service est indisponible, la carte reste simplement sans décor.
 */
export interface Geo { lat: number; lng: number }
export interface NearRoad { kind: "major" | "minor" | "foot"; pts: Geo[] }
export interface NearArea { kind: "park" | "water"; pts: Geo[] }
export interface NearPoi { kind: string; lat: number; lng: number; name?: string }
/** Monument connu : a un nom et une page Wikipédia (étiquette OpenStreetMap « wikipedia », du type « fr:Tour Eiffel »). */
export interface NearLandmark { name: string; wiki: string; pts: Geo[] }
export interface Nearby { roads: NearRoad[]; areas: NearArea[]; pois: NearPoi[]; landmarks: NearLandmark[] }

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const RADIUS = 260;
const MIN_MOVE_M = 100;
const MIN_GAP_MS = 60_000;

function distM(a: Geo, b: Geo) {
  const dLat = (a.lat - b.lat) * 111_320, dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

const query = (c: Geo) => `[out:json][timeout:10];(
nwr(around:${RADIUS},${c.lat},${c.lng})["name"]["wikipedia"]["historic"];
nwr(around:${RADIUS},${c.lat},${c.lng})["name"]["wikipedia"]["tourism"~"^(attraction|museum|artwork|viewpoint)$"];
nwr(around:${RADIUS},${c.lat},${c.lng})["name"]["wikipedia"]["man_made"~"^(tower|lighthouse|bridge|obelisk)$"];
nwr(around:${RADIUS},${c.lat},${c.lng})["name"]["wikipedia"]["amenity"~"^(place_of_worship|theatre|townhall)$"];
way(around:${RADIUS},${c.lat},${c.lng})["highway"~"^(primary|secondary|tertiary|residential|living_street|pedestrian|footway|path|cycleway|service|steps|unclassified)$"];
way(around:${RADIUS},${c.lat},${c.lng})["leisure"~"^(park|garden|playground)$"];
way(around:${RADIUS},${c.lat},${c.lng})["natural"="water"];
node(around:${RADIUS},${c.lat},${c.lng})["amenity"~"^(cafe|restaurant|drinking_water|fountain|toilets|bench|pharmacy|bicycle_parking)$"];
);out geom 500;`;

interface El { type: string; lat?: number; lon?: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[]; center?: { lat: number; lon: number }; bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number } }

function parse(els: El[]): Nearby {
  const out: Nearby = { roads: [], areas: [], pois: [], landmarks: [] };
  const seen = new Set<string>();
  for (const e of els) {
    const t = e.tags ?? {};
    if (t.name && t.wikipedia && /^[a-z-]{2,8}:.+/.test(t.wikipedia)) {
      // Monument : un point (nœud), le contour (chemin) ou le centre de la zone (relation).
      const pts: Geo[] = e.type === "node" && e.lat != null && e.lon != null ? [{ lat: e.lat, lng: e.lon }]
        : e.geometry?.length ? e.geometry.map((g) => ({ lat: g.lat, lng: g.lon }))
        : e.bounds ? [{ lat: (e.bounds.minlat + e.bounds.maxlat) / 2, lng: (e.bounds.minlon + e.bounds.maxlon) / 2 }]
        : e.center ? [{ lat: e.center.lat, lng: e.center.lon }] : [];
      if (pts.length && !seen.has(t.wikipedia)) { seen.add(t.wikipedia); out.landmarks.push({ name: t.name, wiki: t.wikipedia, pts }); }
      continue;
    }
    if (e.type === "node" && e.lat != null && e.lon != null) {
      out.pois.push({ kind: t.amenity ?? "poi", lat: e.lat, lng: e.lon, name: t.name });
    } else if (e.type === "way" && e.geometry && e.geometry.length > 1) {
      const pts = e.geometry.map((g) => ({ lat: g.lat, lng: g.lon }));
      if (t.highway) {
        const h = t.highway;
        out.roads.push({ kind: /^(primary|secondary|tertiary)$/.test(h) ? "major" : /^(footway|path|pedestrian|steps|cycleway)$/.test(h) ? "foot" : "minor", pts });
      } else if (t.natural === "water") out.areas.push({ kind: "water", pts });
      else out.areas.push({ kind: "park", pts });
    }
  }
  return out;
}

/** Charge (et met en cache) les éléments autour de la position courante tant que `active` est vrai. */
export function useNearby(cur: Geo | undefined, active: boolean): Nearby | null {
  const [data, setData] = useState<Nearby | null>(null);
  const last = useRef<{ c: Geo; at: number } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!active || !cur || busy.current) return;
    const l = last.current;
    if (l && (distM(l.c, cur) < MIN_MOVE_M || Date.now() - l.at < MIN_GAP_MS)) return;
    busy.current = true;
    last.current = { c: cur, at: Date.now() };
    const ctrl = new AbortController();
    fetch(ENDPOINT, { method: "POST", body: `data=${encodeURIComponent(query(cur))}`, headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { elements?: El[] }) => setData(parse(j.elements ?? [])))
      .catch(() => undefined)
      .finally(() => { busy.current = false; });
    return () => ctrl.abort();
  }, [cur?.lat, cur?.lng, active]); // eslint-disable-line react-hooks/exhaustive-deps

  return data;
}
