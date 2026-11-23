"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { Back } from "@/components/Back";
import { ShoeSprite } from "@/components/ShoeSprite";
import { useSession } from "@/components/SessionProvider";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { forgeIxs, payAndConfirm, shopIxs, type ForgeQuote, type ShopQuote } from "@/lib/pay";

interface Shoe {
  id: string; model_name: string; rarity: string; level: number; is_equipped: boolean; listed: boolean; upgrading_until: string | null;
  visual: { color: string; effects: never[]; tier?: string }; durability: number; reward_factor: number; repair_cost_walk: number;
  upgrade: { to_level: number; cost_walk: number; minutes: number } | null;
}
const RAR_COLOR: Record<string, string> = { common: "#CBD5E1", rare: "#3B82F6", epic: "#A855F7", legendary: "#F59E0B", mythic: "#F43F5E" };

/** « Mes chaussures » : équiper, améliorer (paiement en $WALK), réparer et fusionner (craft). */
export default function ShoesPage() {
  const { me, refresh } = useSession();
  const { t, msg: tr, num } = useI18n();
  const wallet = useWallet(); const { connection } = useConnection();
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [minLv, setMinLv] = useState(4);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [fpick, setFpick] = useState<string[]>([]);
  const [forgeInfo, setForgeInfo] = useState<{ enabled: boolean; easy_max_level: number; levels: { from: number; to: number; walk: number; sol: number }[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const r = await api<{ shoes: Shoe[]; craft_min_level: number }>("/shoes");
    setShoes(r.shoes); setMinLv(r.craft_min_level);
  }, []);
  useEffect(() => { if (me) void load().catch(() => undefined); }, [me, load]);
  useEffect(() => { if (me) api<NonNullable<typeof forgeInfo>>("/forge/info").then(setForgeInfo).catch(() => undefined); }, [me]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  // Quand une amélioration arrive à échéance, on recharge pour voir le nouveau niveau.
  useEffect(() => {
    if (shoes.some((s) => s.upgrading_until && new Date(s.upgrading_until).getTime() <= now)) void load().then(refresh).catch(() => undefined);
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return <main className="p-8 text-slate-300">{t("common.needLogin")}</main>;

  const fail = (e: unknown) => setNote(e instanceof ApiError ? tr(e.message, e.code, e.params) : t("common.cancelled"));
  const left = (iso: string | null) => {
    const s = Math.max(0, Math.ceil((new Date(iso ?? 0).getTime() - now) / 1000));
    return s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
  };
  const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key); setNote(null);
    try { await fn(); if (ok) setNote(ok); await load(); await refresh(); } catch (e) { fail(e); } finally { setBusy(null); }
  }
  const equip = (s: Shoe) => run(`e${s.id}`, () => api(`/shoes/${s.id}/equip`, { body: {} }), t("shoes.equipOk"));
  const upgrade = (s: Shoe) => run(`u${s.id}`, async () => {
    const q = await api<ShopQuote & { order_id: string }>(`/shoes/${s.id}/upgrade/order`, { body: {} });
    await payAndConfirm({ wallet, connection, ixs: shopIxs(q), confirmPath: `/upgrade/orders/${q.order_id}/confirm`, expectedPayer: q.payer });
  }, t("shoes.upgraded"));
  const repair = (s: Shoe) => run(`r${s.id}`, async () => {
    const q = await api<ShopQuote & { order_id: string }>(`/shoes/${s.id}/repair/order`, { body: {} });
    await payAndConfirm({ wallet, connection, ixs: shopIxs(q), confirmPath: `/repair/orders/${q.order_id}/confirm`, expectedPayer: q.payer });
  }, t("shoes.repaired"));

  // Craft : on ne peut cocher que des chaussures de même rareté, libres, de niveau suffisant.
  const craftable = (s: Shoe) => !s.listed && !(s.upgrading_until && new Date(s.upgrading_until).getTime() > now) && s.level >= minLv && s.rarity !== "mythic";
  const pickedRarity = shoes.find((s) => s.id === pick[0])?.rarity;
  const toggle = (s: Shoe) => setPick((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : p.length < 3 && (!pickedRarity || pickedRarity === s.rarity) ? [...p, s.id] : p));
  const craft = () => run("craft", async () => {
    const r = await api<{ shoe: { name: string; level: number } }>("/shoes/craft", { body: { ids: pick } });
    setPick([]);
    setNote(t("shoes.craftOk", { name: r.shoe.name, lv: r.shoe.level }));
  }, "");

  // Forge : 3 chaussures libres du même niveau.
  const forgeable = (s: Shoe) => !s.listed && !(s.upgrading_until && new Date(s.upgrading_until).getTime() > now) && s.level < (forgeInfo?.levels.length ?? 0) + 1;
  const fLevel = shoes.find((s) => s.id === fpick[0])?.level;
  const ftoggle = (s: Shoe) => setFpick((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : p.length < 3 && (fLevel === undefined || fLevel === s.level) ? [...p, s.id] : p));
  const fcost = forgeInfo?.levels.find((l) => l.from === fLevel);
  const forge = () => run("forge", async () => {
    const q = await api<ForgeQuote & { order_id: string }>("/forge/order", { body: { ids: fpick } });
    await payAndConfirm({ wallet, connection, ixs: forgeIxs(q), confirmPath: `/forge/orders/${q.order_id}/confirm`, expectedPayer: q.payer });
    setFpick([]);
  }, t("shoes.forgeOk"));

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <Back />
      <h1 className="font-display text-2xl text-white">{t("shoes.title")}</h1>
      <p className="text-sm text-slate-300">{t("shoes.intro")}</p>
      {note && <p role="status" className="text-sm text-legend">{note}</p>}

      <ul className="grid gap-4 sm:grid-cols-2">
        {shoes.map((s) => {
          const up = Boolean(s.upgrading_until && new Date(s.upgrading_until).getTime() > now);
          const col = RAR_COLOR[s.rarity] ?? "#CBD5E1";
          const can = craftable(s);
          return (
            <li key={s.id} className="glass space-y-3 p-4" style={{ borderColor: col }}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-display" style={{ color: col }}>{t(`rar.${s.rarity}` as "rar.common")}</span>
                {s.is_equipped && <span className="rounded-full border border-neon/60 px-2 py-0.5 text-neon">{t("shoes.equipped")}</span>}
                {s.listed && <span className="rounded-full border border-legend/60 px-2 py-0.5 text-legend">{t("shoes.listed")}</span>}
              </div>
              <ShoeSprite level={s.level} visual={s.visual} className="mx-auto w-48" />
              <p className="text-center font-display text-white">{s.model_name} · {t("common.level", { n: s.level })}</p>

              <div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${s.durability}%`, background: s.durability < 25 ? "#F43F5E" : "#39FF88" }} /></div>
                <p className="mt-1 text-[11px] text-slate-400">{t("shoes.dur", { p: Math.round(s.durability) })}{s.reward_factor < 1 ? ` · ${t("shoes.worn", { f: Math.round(s.reward_factor * 100) })}` : ""}</p>
              </div>

              <div className="grid gap-2">
                {!s.is_equipped && !s.listed && <button disabled={busy !== null} onClick={() => void equip(s)} className="min-h-11 rounded-full border border-white/25 text-sm text-slate-100 hover:border-neon disabled:opacity-50">{t("shoes.equip")}</button>}
                {up ? <p className="rounded-full border border-legend/50 py-2.5 text-center text-sm text-legend">{t("shoes.upgrading", { t: left(s.upgrading_until) })}</p>
                  : s.upgrade ? <button disabled={busy !== null || s.listed} onClick={() => void upgrade(s)} className="min-h-11 rounded-full bg-neon px-3 text-sm font-semibold text-night disabled:bg-white/10 disabled:text-slate-400">
                    {busy === `u${s.id}` ? t("common.paying") : t("shoes.upgradeBtn", { n: s.upgrade.to_level, c: num(s.upgrade.cost_walk), d: dur(s.upgrade.minutes) })}</button>
                    : <p className="text-center text-xs text-slate-400">{t("shoes.max")}</p>}
                {s.durability < 100 && <button disabled={busy !== null} onClick={() => void repair(s)} className="min-h-11 rounded-full border border-white/25 text-sm text-slate-100 hover:border-neon disabled:opacity-50">
                  {busy === `r${s.id}` ? t("common.paying") : t("shoes.repairBtn", { c: num(s.repair_cost_walk) })}</button>}
                <label className={`flex items-center justify-center gap-2 text-xs ${forgeable(s) ? "text-orange-300" : "text-slate-500"}`}>
                  <input type="checkbox" disabled={!forgeable(s) || (fpick.length >= 3 && !fpick.includes(s.id)) || Boolean(fLevel !== undefined && fLevel !== s.level && !fpick.includes(s.id))} checked={fpick.includes(s.id)} onChange={() => ftoggle(s)} />
                  {t("shoes.forgePick")}
                </label>
                <label className={`flex items-center justify-center gap-2 text-xs ${can ? "text-slate-200" : "text-slate-500"}`}>
                  <input type="checkbox" disabled={!can || (pick.length >= 3 && !pick.includes(s.id)) || Boolean(pickedRarity && pickedRarity !== s.rarity && !pick.includes(s.id))} checked={pick.includes(s.id)} onChange={() => toggle(s)} />
                  {t("shoes.craftPick")}
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      {forgeInfo?.enabled && (
        <section className="glass space-y-3 border-orange-400/60 p-5">
          <h2 className="font-display text-lg text-orange-300">{t("shoes.forgeTitle")}</h2>
          <p className="text-sm text-slate-300">{t("shoes.forgeP", { lv: forgeInfo.easy_max_level })}</p>
          {fcost && <p className="text-sm text-white">{t("shoes.forgeCost", { to: fcost.to, w: num(fcost.walk), s: fcost.sol })}</p>}
          <button disabled={fpick.length !== 3 || busy !== null} onClick={() => void forge()} className="min-h-12 w-full rounded-full bg-orange-400 font-display font-bold text-night disabled:bg-white/10 disabled:text-slate-400">
            {busy === "forge" ? t("common.paying") : t("shoes.forgeBtn", { n: fpick.length })}
          </button>
          <details className="text-xs text-slate-300">
            <summary className="cursor-pointer text-slate-200">{t("shoes.forgeTable")}</summary>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {forgeInfo.levels.map((l) => <li key={l.from}>{l.from} → {l.to} : {num(l.walk)} $WALK + {l.sol} SOL</li>)}
            </ul>
          </details>
        </section>
      )}

      <section className="glass space-y-3 p-5">
        <h2 className="font-display text-lg text-white">{t("shoes.craftTitle")}</h2>
        <p className="text-sm text-slate-300">{t("shoes.craftP", { lv: minLv })}</p>
        <button disabled={pick.length !== 3 || busy !== null} onClick={() => void craft()} className="min-h-12 w-full rounded-full bg-neon font-display font-bold text-night disabled:bg-white/10 disabled:text-slate-400">
          {t("shoes.craftBtn", { n: pick.length })}
        </button>
      </section>
    </main>
  );
}
