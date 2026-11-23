"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/** Discreet public counter at the bottom of every page: total players and players online. */
export function PlayerPulse() {
  const { t, num } = useI18n();
  const [s, setS] = useState<{ players: number; online: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api<{ players: number; online: number }>("/stats").then((v) => alive && setS(v)).catch(() => {});
    void load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  if (!s) return null;
  return (
    <p className="mt-4 pb-24 text-center text-[11px] text-slate-400/80">
      <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon align-middle" />
      {t("pulse.line", { n: num(s.players), o: num(s.online) })}
    </p>
  );
}
