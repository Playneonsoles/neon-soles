"use client";

import { Badges } from "@/components/Badges";
import { WalletCard } from "@/components/WalletCard";
import { DeleteAccount } from "@/components/DeleteAccount";
import { Avatar } from "@/components/Avatar";
import { useCallback, useEffect, useState } from "react";
import { Back } from "@/components/Back";
import { ShoeSprite } from "@/components/ShoeSprite";
import { useSession } from "@/components/SessionProvider";
import { ApiError, api } from "@/lib/api";
import { formatWalk } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface ClaimRow { id: string; status: string; amount: string; fee: string; net: string; tx_signature: string | null; created_at: string }
interface Inv { shoes: { id: string; model_name: string; level: number; is_equipped: boolean; source: string; visual: { color: string; effects: never[] } }[]; collectibles: { id: string; name: string; rarity: string }[] }

export default function ProfilePage() {
  const { me, refresh } = useSession();
  const { t, msg: tr, locale, date } = useI18n();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [inv, setInv] = useState<Inv | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setClaims((await api<{ claims: ClaimRow[] }>("/claims")).claims);
    setInv(await api<Inv>("/shoes"));
  }, []);
  useEffect(() => { if (me) void load().catch(() => undefined); }, [me, load]);
  // Pendant qu'un retrait est en cours, on rafraîchit toutes les 10 s.
  useEffect(() => {
    if (!claims.some((c) => c.status === "queued" || c.status === "sent")) return;
    const t = window.setInterval(() => { void load(); void refresh(); }, 10_000);
    return () => window.clearInterval(t);
  }, [claims, load, refresh]);
  if (!me) return <main className="p-8 text-slate-300">{t("common.needLogin")}</main>;

  const fee = Math.ceil(Number(me.balances.claimable) * me.claim_fee_pct) / 100;
  async function withdraw() {
    setBusy(true); setMsg(null);
    try { await api("/claims", { body: {} }); setMsg(t("profile.claimOk")); await refresh(); await load(); }
    catch (e) { setMsg(e instanceof ApiError ? tr(e.message, e.code, e.params) : t("profile.claimFail")); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Back />
      <header className="flex items-center gap-3">
        {me.profile?.avatar != null && <Avatar face={me.profile.avatar} className="block w-16" />}
        <div>
          <h1 className="font-display text-2xl text-white">{me.pseudo}</h1>
          <Badges codes={me.badges} full />
          <p className="text-sm text-slate-300">{t("profile.streakLine", { d: me.streak_days, l: me.level })}</p>
        </div>
      </header>

      <WalletCard />

      <section className="glass space-y-3 p-5">
        <h2 className="font-display text-lg text-white">{t("profile.mine")}</h2>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div><p className="text-xs text-slate-300">{t("profile.pending")}</p><p className="font-display text-xl text-white">{formatWalk(me.balances.pending, locale)}</p></div>
          <div><p className="text-xs text-slate-300">{t("profile.claimable")}</p><p className="font-display text-xl text-neon">{formatWalk(me.balances.claimable, locale)}</p></div>
        </div>
        <p className="text-sm text-slate-300">{t("profile.info", { w: `${me.wallet.slice(0, 4)}…${me.wallet.slice(-4)}`, fee: me.claim_fee_pct, min: me.claim_min })}</p>
        <button disabled={busy || me.claims_paused || BigInt(me.balances.claimable) <= 0n} onClick={() => void withdraw()} className="h-14 w-full rounded-full bg-neon font-display text-lg font-black text-night shadow-neon disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 disabled:shadow-none">
          {me.claims_paused ? t("profile.paused") : busy ? t("profile.requesting") : t("profile.withdraw")}
        </button>
        {fee > 0 && <p className="text-xs text-slate-400">{t("profile.feeEst", { n: formatWalk(String(Math.ceil(Number(me.balances.claimable) * me.claim_fee_pct / 100)), locale) })}</p>}
        {msg && <p role="status" className="text-sm text-legend">{msg}</p>}
        {claims.length > 0 && (
          <ul className="divide-y divide-white/10 text-sm text-slate-200">
            {claims.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span>{date(c.created_at)}</span>
                <span>{formatWalk(c.net, locale)} $WALK · {t(`claim.${c.status}` as "claim.sent")}{c.tx_signature && c.status === "confirmed" && <> · <a className="underline" target="_blank" rel="noreferrer noopener" href={`https://solscan.io/tx/${c.tx_signature}`}>{t("profile.view")}</a></>}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass space-y-3 p-5">
        <h2 className="font-display text-lg text-white">{t("profile.shoes")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {inv?.shoes.map((s) => (
            <li key={s.id} className="rounded-2xl border border-white/15 p-3 text-center">
              <ShoeSprite level={s.level} visual={s.visual} className="mx-auto w-40" />
              <p className="text-sm text-white">{t("profile.shoeLine", { model: s.model_name, n: s.level })} {s.is_equipped && <span className="text-neon">· {t("profile.equipped")}</span>}</p>
            </li>
          ))}
        </ul>
        {inv && inv.collectibles.length > 0 && <>
          <h3 className="pt-2 font-display text-white">{t("profile.collectibles")}</h3>
          <ul className="flex flex-wrap gap-2">{inv.collectibles.map((c) => <li key={c.id} className="rounded-full border border-white/20 px-3 py-1 text-sm text-white">{c.name}</li>)}</ul>
        </>}
      </section>
      <div className="flex gap-4 text-sm"><a className="underline" href="/shop">{t("profile.shopLink")}</a><a className="underline" href="/market">{t("profile.marketLink")}</a></div>
      <p className="text-center text-xs text-slate-400"><a href="/privacy" className="underline underline-offset-4">{t("priv.link")}</a></p>
      <DeleteAccount />
    </main>
  );
}
