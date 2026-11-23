"use client";

import { haversineM } from "@walk/game";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { deviceHash } from "@/lib/fingerprint";
import { clock, formatWalk } from "@/lib/format";
import { StepCounter } from "@/lib/steps";
import { RouteImage } from "./RouteImage";
import { WalkMap, type MapPoint } from "./WalkMap";
import { useI18n } from "@/lib/i18n";
import { useSession } from "./SessionProvider";

interface StartRes { session_id: string; session_token: string; max_seconds: number; min_speed_kmh: number; reward_per_minute: number; packet_interval_s: number; max_pause_s: number }
interface EndRes { status: "valid" | "review" | "rejected"; valid_seconds: number; distance_m: number; steps: number; estimated_reward: string; hint: string | null; gift?: { type: "walk"; amount: string } | { type: "collectible"; code: string; name: string; rarity: string } | { type: "shoe"; model: string; name: string; level: number; rarity: string } | null }
interface Pt { ts: number; lat: number; lng: number; accuracy: number | null; speed: number | null; steps: number }
type Phase = "ready" | "running" | "ending" | "done";

const MIN_KMH = 2.5, MAX_KMH = 7; // même fenêtre que le serveur (section 7), pour l'affichage seulement

export function WalkScreen({ onExit }: { onExit: () => void }) {
  const { refresh } = useSession();
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<StartRes | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState({ distance: 0, speed: 0, validSec: 0, steps: 0 });
  const [result, setResult] = useState<EndRes | null>(null);
  const [track, setTrack] = useState<MapPoint[]>([]);
  // Autorisation de localisation : "unknown" tant qu'on ne sait pas, puis "prompt" (jamais demandée), "granted" ou "denied".
  const [geo, setGeo] = useState<"unknown" | "prompt" | "granted" | "denied">("unknown");
  const [paused, setPaused] = useState(false);
  const [pauseLeft, setPauseLeft] = useState(0);
  const [starting, setStarting] = useState(false); // évite les doubles clics et montre que ça démarre
  const [denied, setDenied] = useState(false); // marche sans localisation (carte grise)
  const { me } = useSession();
  const { t, msg, locale } = useI18n();

  const r = useRef({
    info: null as StartRes | null, buf: [] as Pt[], last: null as Pt | null, distance: 0, validSec: 0, elapsed: 0,
    full: [] as MapPoint[], watch: -1, tick: 0, flush: 0, lock: null as WakeLockSentinel | null, steps: new StepCounter(), ending: false, starting: false, paused: false, pauseTick: 0, motion: false, located: false,
  });

  useEffect(() => {
    if (!("geolocation" in navigator)) { setGeo("denied"); return; }
    let st: PermissionStatus | null = null;
    const apply = () => st && setGeo(st.state as "prompt" | "granted" | "denied");
    navigator.permissions?.query({ name: "geolocation" }).then((x) => { st = x; apply(); x.onchange = apply; }).catch(() => setGeo("prompt"));
    return () => { if (st) st.onchange = null; };
  }, []);

  /** Déclenche la demande d'autorisation du navigateur (une seule position, depuis un clic). Renvoie false si refusée ou indisponible. */
  const askGeo = useCallback(() => new Promise<boolean>((resolve) => {
    if (!("geolocation" in navigator)) return resolve(false);
    navigator.geolocation.getCurrentPosition(() => { setGeo("granted"); resolve(true); }, (e) => { if (e.code === 1) setGeo("denied"); resolve(e.code !== 1); }, { enableHighAccuracy: true, timeout: 8_000, maximumAge: 120_000 });
  }), []);

  const acquireLock = useCallback(async () => {
    try { r.current.lock = (await navigator.wakeLock?.request("screen")) ?? null; } catch { /* non bloquant */ }
  }, []);

  const flush = useCallback(async () => {
    const s = r.current;
    if (!s.info || s.buf.length === 0) return;
    const batch = s.buf.splice(0, 40);
    try {
      await api(`/walk/${s.info.session_id}/points`, { body: { points: batch }, headers: { "x-walk-session": s.info.session_token } });
    } catch { s.buf.unshift(...batch); } // renvoyé au prochain paquet
  }, []);

  const cleanup = useCallback(() => {
    const s = r.current;
    navigator.geolocation.clearWatch(s.watch);
    clearInterval(s.tick); clearInterval(s.flush); clearInterval(s.pauseTick);
    s.steps.stop(); s.lock?.release().catch(() => undefined);
  }, []);

  const end = useCallback(async () => {
    const s = r.current;
    if (s.ending || !s.info) return;
    s.ending = true; setPhase("ending"); cleanup();
    try {
      for (let i = 0; i < 3 && s.buf.length; i++) await flush();
      const res = await api<EndRes>(`/walk/${s.info.session_id}/end`, { method: "POST", headers: { "x-walk-session": s.info.session_token } });
      setResult(res); setPhase("done"); navigator.vibrate?.(res.status === "valid" ? [80, 60, 80] : 200);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? msg(e.message, e.code, e.params) : t("walk.endFail")); s.ending = false; setPhase("running");
    }
  }, [cleanup, flush, refresh, t, msg]);

  /** Démarre (ou relance après une pause) le suivi GPS. */
  function beginWatch() {
    const s = r.current;
  s.watch = navigator.geolocation.watchPosition(
      (pos) => {
        const ts = pos.timestamp;
        if (s.last && ts - s.last.ts < 2500) return; // un point toutes les ~3 s
        const p: Pt = { ts, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, speed: pos.coords.speed, steps: s.steps.steps };
        let kmh = 0;
        if (s.last) {
          const dt = (ts - s.last.ts) / 1000, d = haversineM(s.last, p);
          kmh = (d / dt) * 3.6;
          if (dt <= 10 && (pos.coords.accuracy ?? 99) <= 30 && kmh >= MIN_KMH && kmh <= MAX_KMH) { s.distance += d; s.validSec += dt; }
        }
        s.last = p; s.buf.push(p);
        setLive({ distance: s.distance, speed: kmh, validSec: s.validSec, steps: s.steps.steps });
        if (!p.accuracy || p.accuracy <= 50) s.full.push({ lat: p.lat, lng: p.lng });
        setTrack((t) => [...t.slice(-239), { lat: p.lat, lng: p.lng }]);
      },
      (err) => { if (err.code === 1) { setDenied(true); setGeo("denied"); navigator.geolocation.clearWatch(s.watch); } else setError(t("walk.geoDenied")); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  }

  async function start() {
    if (r.current.starting) return; // un seul démarrage à la fois (plusieurs clics = une seule session)
    r.current.starting = true; setStarting(true);
    try { await doStart(); } finally { r.current.starting = false; setStarting(false); }
  }

  async function doStart() {
    setError(null);
    // L'autorisation des capteurs iPhone doit être demandée directement depuis le geste (le clic).
    const motion = await StepCounter.requestPermission();
    // Localisation : on demande l'autorisation avant de partir. Si elle est refusée, la marche reste possible, sans carte (carte grise).
    const located = geo === "denied" ? false : geo === "granted" || geo === "unknown" ? true : await askGeo(); // « unknown » : le suivi GPS demandera lui-même l'autorisation
    setDenied(!located);
    try {
      const res = await api<StartRes>("/walk/start", { body: { device_hash: await deviceHash() } });
      const s = r.current;
      s.info = res; setInfo(res);
      if (motion) s.steps.start();
      await acquireLock();

      s.motion = motion; s.located = located;
      if (located) beginWatch();
      // Le chrono ne tourne que si l'app est visible (en arrière-plan, il se met en pause).
      s.tick = window.setInterval(() => {
        if (document.visibilityState !== "visible" || s.paused) return;
        s.elapsed++; setElapsed(s.elapsed);
        if (s.elapsed >= res.max_seconds) void end();
      }, 1000);
      s.flush = window.setInterval(() => void flush(), res.packet_interval_s * 1000);
      setPhase("running");
    } catch (e) {
      setError(e instanceof ApiError ? msg(e.message, e.code, e.params) : t("walk.startFail"));
    }
  }

  const hdr = () => ({ "x-walk-session": r.current.info!.session_token });

  /** Pause : on arrête le GPS, le chrono et les capteurs ; le temps de pause est plafonné par le serveur. */
  async function pause() {
    const s = r.current;
    if (!s.info || s.paused || s.ending) return;
    try {
      await flush();
      const res = await api<{ pause_left_s: number }>(`/walk/${s.info.session_id}/pause`, { method: "POST", headers: hdr() });
      s.paused = true; setPaused(true); setPauseLeft(res.pause_left_s); setError(null);
      navigator.geolocation.clearWatch(s.watch); s.steps.stop(); s.lock?.release().catch(() => undefined);
      clearInterval(s.pauseTick);
      s.pauseTick = window.setInterval(() => {
        setPauseLeft((v) => {
          if (v <= 1) { clearInterval(s.pauseTick); window.setTimeout(() => void end(), 0); return 0; } // pause épuisée : la marche se termine
          return v - 1;
        });
      }, 1000);
    } catch (e) { setError(e instanceof ApiError ? msg(e.message, e.code, e.params) : t("walk.pauseFail")); }
  }

  async function resume() {
    const s = r.current;
    if (!s.info || !s.paused || s.ending) return;
    try {
      await api(`/walk/${s.info.session_id}/resume`, { method: "POST", headers: hdr() });
    } catch (e) {
      if (e instanceof ApiError && e.code === "pause_expired") { void end(); return; }
      setError(e instanceof ApiError ? msg(e.message, e.code, e.params) : t("walk.pauseFail")); return;
    }
    clearInterval(s.pauseTick);
    s.paused = false; s.last = null; setPaused(false); setError(null);
    if (s.motion) s.steps.start();
    await acquireLock();
    if (s.located) beginWatch();
  }

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible" && r.current.info && !r.current.ending) void acquireLock(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); cleanup(); };
  }, [acquireLock, cleanup]);

  const max = info?.max_seconds ?? 300;
  const gain = info ? Math.min(live.validSec, max) / 60 * info.reward_per_minute : 0;

  return (
    <section className="mx-auto w-full max-w-md space-y-5 text-center">
      {phase === "ready" && (
        <div className="glass space-y-4 p-6">
          <h2 className="font-display text-2xl text-white">{t("walk.readyTitle")}</h2>
          <p className="text-slate-300">{t("walk.readyText")}</p>
          {geo === "denied"
            ? <p className="rounded-xl border border-amber-300/50 bg-amber-300/10 p-3 text-left text-sm text-amber-100" role="status">📍 {t("walk.geoBlocked")}</p>
            : <p className="text-left text-sm text-slate-300">📍 {t("walk.geoWhy")}</p>}
          {geo === "prompt" && <button onClick={() => void askGeo()} className="min-h-11 w-full rounded-full border border-cyan-400/70 bg-cyan-400/15 text-sm font-semibold text-cyan-300">{t("walk.geoAllow")}</button>}
          <button onClick={() => void start()} disabled={starting} aria-busy={starting} className="h-16 w-full rounded-full bg-neon font-display text-xl font-black text-night shadow-neon disabled:opacity-70">{starting ? t("walk.starting") : t("walk.go")}</button>
          <button onClick={onExit} className="text-sm text-slate-300 underline underline-offset-4">{t("walk.back")}</button>
        </div>
      )}

      {(phase === "running" || phase === "ending") && (
        <>
          {me?.shoe && <WalkMap points={track} visual={me.shoe.visual} level={me.shoe.level} moving={paused ? false : denied ? phase === "running" : live.speed >= MIN_KMH} face={me.profile?.avatar} denied={denied} />}
          <div>
            <p className="font-display text-5xl font-black text-white" aria-live="off">{clock(elapsed)} <span className="text-base font-normal text-slate-300">{t("walk.of")} {clock(max)}</span></p>
            <div className="mx-auto mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div className="h-full rounded-full bg-neon" style={{ width: `${Math.min(elapsed / max, 1) * 100}%`, transition: "width 1s linear", boxShadow: "0 0 8px #39FF88" }} />
            </div>
          </div>
          <div className="glass grid grid-cols-3 gap-3 p-4">
            <div><p className="text-xs text-slate-300">{t("walk.steps")}</p><p className="font-display text-xl text-white">{live.steps}</p></div>
            <div><p className="text-xs text-slate-300">{t("walk.distance")}</p><p className="font-display text-xl text-white">{(live.distance / 1000).toFixed(2)} km</p></div>
            <div><p className="text-xs text-slate-300">{t("walk.speed")}</p><p className="font-display text-xl text-white">{live.speed.toFixed(1)} km/h</p></div>
          </div>
          <div className="glass py-4" role="status" aria-label={t("walk.estimate")}>
            <p className="font-display text-5xl font-black text-neon" style={{ textShadow: "0 0 18px rgba(57,255,136,.5)" }}>+{gain.toFixed(2)}</p>
            <p className="text-sm text-slate-300">{t("walk.earned")}</p>
          </div>
          {paused && (
            <div className="rounded-2xl border border-cyan-400/60 bg-cyan-400/10 p-4" role="status">
              <p className="font-display text-lg text-cyan-200">⏸ {t("walk.pausedTitle")}</p>
              <p className="text-sm text-slate-200">{t("walk.pausedLeft", { t: clock(pauseLeft) })}</p>
            </div>
          )}
          {!paused && info && live.speed > 0 && live.speed < info.min_speed_kmh && <p role="status" className="text-sm text-legend">{t("walk.speedUp", { min: info.min_speed_kmh })}</p>}
          {paused && <button onClick={() => void resume()} className="h-16 w-full rounded-full bg-neon font-display text-xl font-black text-night shadow-neon">▶ {t("walk.resume")}</button>}
          <div className="flex items-center justify-center gap-3">
            {!paused && info && info.max_pause_s > 0 && phase === "running" && (
              <button onClick={() => void pause()} className="h-12 rounded-full border border-cyan-400/70 bg-cyan-400/10 px-7 font-semibold text-cyan-200">⏸ {t("walk.pause")}</button>
            )}
            <button onClick={() => void end()} disabled={phase === "ending"} className="h-12 rounded-full border border-white/30 px-8 text-slate-200 disabled:opacity-50">
              {phase === "ending" ? t("walk.ending") : t("walk.finish")}
            </button>
          </div>
        </>
      )}

      {phase === "done" && result && (
        <div className="glass space-y-3 p-6">
          <h2 className="font-display text-2xl text-white">
            {result.status === "valid" ? t("walk.valid") : result.status === "review" ? t("walk.review") : t("walk.rejected")}
          </h2>
          {result.status !== "rejected" && <p className="font-display text-4xl text-neon">+{formatWalk(result.estimated_reward, locale)} <span className="text-base text-slate-300">$WALK</span></p>}
          {result.status === "valid" && <p className="text-sm text-slate-300">{t("walk.pendingNote")}</p>}
          {result.status === "review" && <p className="text-sm text-slate-300">{t("walk.reviewNote")}</p>}
          {denied && <p className="text-sm text-amber-200">{t("walk.deniedResult")}</p>}
          {result.hint && <p className="text-sm text-legend">{msg(result.hint)}</p>}
          <p className="text-sm text-slate-300">{(result.distance_m / 1000).toFixed(2)} km · {clock(result.valid_seconds)} · {result.steps} {t("walk.stepsUnit")}</p>
          {result.gift && (
            <div className="nw-rise rounded-2xl border border-fuchsia-400/60 bg-fuchsia-400/10 p-4 shadow-[0_0_22px_-6px_#E879F9]" role="status">
              <p className="text-2xl" aria-hidden>🎁</p>
              <p className="font-display text-lg text-fuchsia-200">{t("gift.title")}</p>
              <p className="text-white">{result.gift.type === "walk" ? t("gift.walk", { n: formatWalk(result.gift.amount, locale) }) : result.gift.type === "shoe" ? t("gift.shoe", { name: result.gift.name, level: result.gift.level }) : t("gift.item", { name: result.gift.name })}</p>
            </div>
          )}
          {result.status !== "rejected" && (
            <RouteImage points={r.current.full} stats={{ km: (result.distance_m / 1000).toFixed(2), time: clock(result.valid_seconds), steps: result.steps, reward: result.status === "valid" ? formatWalk(result.estimated_reward, locale) : null, color: me?.shoe?.visual.color ?? "#39FF88", date: new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) }} />
          )}
          <button onClick={onExit} className="h-12 w-full rounded-full bg-neon font-display font-bold text-night">{t("walk.home")}</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </section>
  );
}
