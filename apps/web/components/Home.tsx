"use client";

import { CopyAddress } from "./WalletCard";
import { Badges } from "./Badges";
import { Engagement } from "./Engagement";
import { useEffect, useState } from "react";
import { formatWalk } from "@/lib/format";
import { ShoeHero } from "./ShoeHero";
import { useI18n } from "@/lib/i18n";
import { useSession } from "./SessionProvider";

const hms = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export function Home({ onWalk }: { onWalk: () => void }) {
  const { me, signOut, refresh } = useSession();
  const { t, locale } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const nextAt = me?.next_session_at ? new Date(me.next_session_at).getTime() : null;
  const waiting = nextAt !== null && nextAt > now;
  // Quand le compte à rebours se termine, on relit le statut pour réactiver le bouton.
  useEffect(() => {
    if (nextAt !== null && nextAt <= now && !me?.can_walk) void refresh();
  }, [nextAt, now, me?.can_walk, refresh]);

  if (!me) return null;
  const canWalk = me.can_walk || (nextAt !== null && nextAt <= now && me.walk_block !== "running");
  const label = me.walk_block === "daily_limit" ? t("home.dailyDone") : t("home.next");

  return (
    <section className="mx-auto w-full max-w-md space-y-4">
      {me.pseudo && <p className="text-center font-display text-lg text-white">{me.pseudo}</p>}
      <Badges codes={me.badges} full className="flex" />
      {me.shoe && <ShoeHero level={me.shoe.level} visual={me.shoe.visual} />}

      <button
        onClick={onWalk} disabled={!canWalk}
        className="h-20 w-full rounded-full bg-neon font-display text-2xl font-black text-night shadow-neon transition enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 disabled:shadow-none"
      >
        {canWalk ? t("home.walk") : waiting && nextAt !== null ? hms(nextAt - now) : "…"}
      </button>
      <p className="text-center text-sm text-slate-300" role="status">
        {canWalk ? t("home.walkN", { n: me.sessions_today + 1, max: me.daily_session_limit }) : label}
        {!canWalk && me.walk_block !== "daily_limit" && " : " + t("home.every", { h: me.cooldown_hours })}
      </p>

      <div className="glass grid grid-cols-3 gap-3 p-5 text-center">
        <div><p className="text-xs text-slate-300">{t("home.streak")}</p><p className="font-display text-xl text-white">{t("home.streakDays", { n: me.streak_days })}</p></div>
        <div><p className="text-xs text-slate-300">{t("home.pending")}</p><p className="font-display text-xl text-white">{formatWalk(me.balances.pending, locale)}</p></div>
        <div><p className="text-xs text-slate-300">{t("home.confirmed")}</p><p className="font-display text-xl text-neon">{formatWalk(me.balances.confirmed, locale)}</p></div>
      </div>
      <CopyAddress wallet={me.wallet} />
      <Engagement />
      <p className="break-all text-center text-xs text-slate-400">{me.wallet}</p>
      <nav className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
        <a href="/shoes" className="rounded-full border py-3 border-emerald-400/70 bg-emerald-400/15 text-emerald-300 shadow-emerald-400/60 font-semibold shadow-[0_0_14px_-4px] transition hover:brightness-125 active:scale-[0.97]">{t("home.shoes")}</a>
        <a href="/profile" className="rounded-full border py-3 border-cyan-400/70 bg-cyan-400/15 text-cyan-300 shadow-cyan-400/60 font-semibold shadow-[0_0_14px_-4px] transition hover:brightness-125 active:scale-[0.97]">{t("home.profile")}</a>
        <a href="/shop" className="rounded-full border py-3 border-amber-400/70 bg-amber-400/15 text-amber-300 shadow-amber-400/60 font-semibold shadow-[0_0_14px_-4px] transition hover:brightness-125 active:scale-[0.97]">{t("home.shop")}</a>
        <a href="/market" className="rounded-full border py-3 border-violet-400/70 bg-violet-400/15 text-violet-300 shadow-violet-400/60 font-semibold shadow-[0_0_14px_-4px] transition hover:brightness-125 active:scale-[0.97]">{t("home.market")}</a>
      </nav>
      <nav className="grid grid-cols-3 gap-2 text-center text-sm">
        <a href="/rules" className="rounded-full border py-3 border-sky-400/70 bg-sky-400/15 text-sky-300 shadow-sky-400/60 font-semibold shadow-[0_0_14px_-4px] transition hover:brightness-125 active:scale-[0.97]">{t("rules.link")}</a>
        <a href="/ranking" className="rounded-full border py-3 border-rose-400/70 bg-rose-400/15 text-rose-300 shadow-rose-400/60 font-semibold shadow-[0_0_14px_-4px] transition hover:brightness-125 active:scale-[0.97]">{t("ranking.link")}</a>
        <a href="/ideas" className="rounded-full border py-3 border-fuchsia-400/70 bg-fuchsia-400/15 text-fuchsia-300 shadow-fuchsia-400/60 font-semibold shadow-[0_0_14px_-4px] transition hover:brightness-125 active:scale-[0.97]">{t("ideas.link")}</a>
      </nav>
      {me.is_admin && <a href="/admin" className="block text-center text-sm text-slate-300 underline underline-offset-4">{t("home.admin")}</a>}
      <button onClick={signOut} className="mx-auto block text-sm text-slate-300 underline underline-offset-4 hover:text-white">{t("home.signOut")}</button>
    </section>
  );
}
