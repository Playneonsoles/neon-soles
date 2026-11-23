"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

export interface RoutePoint { lat: number; lng: number }
export interface RouteStats { km: string; time: string; steps: number; reward: string | null; color: string; date: string }

const W = 1080, H = 1350, MAP_H = 900, SCALE = 1.5; // image finale ; la carte est dessinée à 720×600 puis agrandie
const TILE = 256;
const tileX = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z * TILE;
const tileY = (lat: number, z: number) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z * TILE; };

const dist = (a: RoutePoint, b: RoutePoint) => Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));

/** Retire les ~150 premiers et derniers mètres (pour ne pas montrer le domicile) quand le parcours est assez long. */
function trim(pts: RoutePoint[], m = 150): RoutePoint[] {
  let total = 0; for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!);
  if (total < 600) return pts;
  const start = pts[0]!, end = pts[pts.length - 1]!;
  const out = pts.filter((p) => dist(p, start) > m && dist(p, end) > m);
  return out.length >= 4 ? out : pts;
}

const loadTile = (z: number, x: number, y: number) => new Promise<HTMLImageElement | null>((res) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => res(img);
  img.onerror = () => res(null);
  img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
});

/** Dessine l'image : fond de carte OpenStreetMap (si disponible), tracé lumineux, chiffres, marque. Renvoie un PNG. */
async function draw(canvas: HTMLCanvasElement, raw: RoutePoint[], st: RouteStats, hide: boolean, tiles: boolean, labels: { title: string; km: string; time: string; steps: string; earned: string }) {
  const pts = hide ? trim(raw) : raw;
  const ctx = canvas.getContext("2d")!;
  canvas.width = W; canvas.height = H;
  ctx.fillStyle = "#0B1020"; ctx.fillRect(0, 0, W, H);

  const mapW = W / SCALE, mapH = MAP_H / SCALE;
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  let z = 18;
  while (z > 3 && (tileX(maxLng, z) - tileX(minLng, z) > mapW * 0.72 || tileY(minLat, z) - tileY(maxLat, z) > mapH * 0.72)) z--;
  const cx = (tileX(minLng, z) + tileX(maxLng, z)) / 2, cy = (tileY(minLat, z) + tileY(maxLat, z)) / 2;
  const left = cx - mapW / 2, top = cy - mapH / 2;

  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, MAP_H); ctx.clip();
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#17213d"; ctx.fillRect(0, 0, mapW, mapH);
  const x0 = Math.floor(left / TILE), x1 = Math.floor((left + mapW) / TILE), y0 = Math.floor(top / TILE), y1 = Math.floor((top + mapH) / TILE);
  const n = 2 ** z, jobs: Promise<void>[] = [];
  for (let tx = x0; tx <= x1 && tiles; tx++) for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= n) continue;
    jobs.push(loadTile(z, ((tx % n) + n) % n, ty).then((img) => { if (img) ctx.drawImage(img, tx * TILE - left, ty * TILE - top); }));
  }
  await Promise.all(jobs);
  ctx.fillStyle = "rgba(8,12,28,.5)"; ctx.fillRect(0, 0, mapW, mapH); // assombrit la carte pour faire ressortir le néon
  const xy = (p: RoutePoint) => [tileX(p.lng, z) - left, tileY(p.lat, z) - top] as const;
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = xy(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); };
  ctx.shadowColor = st.color; ctx.shadowBlur = 18; ctx.strokeStyle = st.color; ctx.lineWidth = 6; path(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.globalAlpha = 0.85; path(); ctx.stroke(); ctx.globalAlpha = 1;
  const dot = (p: RoutePoint, c: string) => { const [x, y] = xy(p); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill(); };
  dot(pts[0]!, "#39FF88"); dot(pts[pts.length - 1]!, "#F43F5E");
  ctx.restore();

  // Fondu entre la carte et le panneau
  const g = ctx.createLinearGradient(0, MAP_H - 80, 0, MAP_H); g.addColorStop(0, "rgba(11,16,32,0)"); g.addColorStop(1, "#0B1020");
  ctx.fillStyle = g; ctx.fillRect(0, MAP_H - 80, W, 80);
  ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.font = "16px system-ui, sans-serif"; ctx.textAlign = "right";
  ctx.fillText("© OpenStreetMap contributors", W - 16, MAP_H - 14);

  // Panneau de chiffres
  ctx.textAlign = "left";
  ctx.fillStyle = st.color; ctx.font = "800 46px system-ui, sans-serif"; ctx.fillText("NEON SOLES", 56, MAP_H + 70);
  ctx.fillStyle = "#94A3B8"; ctx.font = "26px system-ui, sans-serif"; ctx.fillText(`${labels.title} · ${st.date}`, 56, MAP_H + 112);
  const stat = (x: number, v: string, l: string) => {
    ctx.fillStyle = "#fff"; ctx.font = "800 64px system-ui, sans-serif"; ctx.fillText(v, x, MAP_H + 220);
    ctx.fillStyle = "#94A3B8"; ctx.font = "24px system-ui, sans-serif"; ctx.fillText(l, x, MAP_H + 258);
  };
  stat(56, st.km, labels.km); stat(380, st.time, labels.time); stat(700, String(st.steps), labels.steps);
  if (st.reward) { ctx.fillStyle = "#39FF88"; ctx.font = "800 54px system-ui, sans-serif"; ctx.fillText(`+${st.reward} $WALK`, 56, MAP_H + 360); ctx.fillStyle = "#94A3B8"; ctx.font = "24px system-ui, sans-serif"; ctx.fillText(labels.earned, 56, MAP_H + 396); }
  ctx.fillStyle = "#64748B"; ctx.font = "22px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.fillText("playneonsoles.com", W - 56, H - 36);
}

/** Après la marche : crée à la demande une image du parcours (carte OpenStreetMap + tracé) à télécharger ou partager. */
export function RouteImage({ points, stats }: { points: RoutePoint[]; stats: RouteStats }) {
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"idle" | "busy" | "ready" | "error">("idle");
  const [hide, setHide] = useState(true);

  const make = async (h = hide) => {
    if (!ref.current || points.length < 2) { setState("error"); return; }
    setState("busy");
    const labels = { title: t("route.title"), km: t("route.km"), time: t("route.time"), steps: t("route.steps"), earned: t("route.earned") };
    try {
      await draw(ref.current, points, stats, h, true, labels);
      try { ref.current.getContext("2d")!.getImageData(0, 0, 1, 1); } // lève une erreur si le fond de carte « contamine » l'image : on redessine sans fond
      catch { await draw(ref.current, points, stats, h, false, labels); }
      setState("ready");
    }
    catch { setState("error"); }
  };
  useEffect(() => { if (state === "ready") void make(hide); }, [hide]); // eslint-disable-line react-hooks/exhaustive-deps

  const blob = () => new Promise<Blob | null>((res) => ref.current?.toBlob(res, "image/png") ?? res(null));
  const download = async () => {
    try {
      const b = await blob(); if (!b) return;
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "neon-soles-walk.png"; a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { setState("error"); }
  };
  const share = async () => {
    try {
      const b = await blob(); if (!b) return;
      const f = new File([b], "neon-soles-walk.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: "Neon Soles" }); else await download();
    } catch { /* annulé */ }
  };

  if (points.length < 2) return null;
  return (
    <div className="space-y-3 text-left">
      {state === "idle" && <button onClick={() => void make()} className="min-h-12 w-full rounded-full border border-cyan-400/70 bg-cyan-400/15 font-semibold text-cyan-300">{t("route.make")}</button>}
      {state === "busy" && <p className="text-center text-sm text-slate-300" role="status">{t("route.busy")}</p>}
      {state === "error" && <p className="text-center text-sm text-red-300" role="alert">{t("route.error")}</p>}
      <canvas ref={ref} className={state === "ready" ? "w-full rounded-2xl border border-white/15" : "hidden"} aria-label={t("route.title")} />
      {state === "ready" && (
        <>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />{t("route.privacy")}</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => void download()} className="min-h-12 rounded-full bg-neon font-semibold text-night">{t("route.download")}</button>
            <button onClick={() => void share()} className="min-h-12 rounded-full border border-white/30 text-slate-100">{t("route.share")}</button>
          </div>
        </>
      )}
    </div>
  );
}
