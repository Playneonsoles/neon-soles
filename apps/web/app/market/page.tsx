"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { Back } from "@/components/Back";
import { ShoeSprite } from "@/components/ShoeSprite";
import { useSession } from "@/components/SessionProvider";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { marketIxs, payAndConfirm, type MarketQuote } from "@/lib/pay";

interface Listing {
  id: string; kind: "shoe" | "collectible"; price_walk: number; mine: boolean; reserved: boolean; fee_lamports: string;
  seller: { pseudo: string | null };
  shoe: { level: number; model_name: string; rarity: string; visual: { color: string; effects: never[]; tier: string } } | null;
  collectible: { name: string; rarity: string; kind: string } | null;
}
interface Inventory { shoes: { id: string; model_name: string; level: number; visual: { color: string; effects: never[] } }[]; collectibles: { id: string; name: string }[] }

export default function MarketPage() {
  const { me } = useSession();
  const { t, msg: tr, num } = useI18n();
  const wallet = useWallet(); const { connection } = useConnection();
  const [kind, setKind] = useState<"" | "shoe" | "collectible">("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [feeMin, setFeeMin] = useState(0.01);
  const [inv, setInv] = useState<Inventory | null>(null);
  const [sell, setSell] = useState<{ kind: "shoe" | "collectible"; id: string; price: string }>({ kind: "shoe", id: "", price: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ listings: Listing[]; fee_min_sol: number }>(`/market/listings${kind ? `?kind=${kind}` : ""}`);
    setListings(r.listings); setFeeMin(r.fee_min_sol);
    setInv(await api<Inventory>("/shoes"));
  }, [kind]);
  useEffect(() => { if (me) void load().catch(() => undefined); }, [me, load]);
  if (!me) return <main className="p-8 text-slate-300">{t("common.needLogin")}</main>;

  const fail = (e: unknown) => setMsg(e instanceof ApiError ? tr(e.message, e.code, e.params) : t("common.cancelled"));

  async function buy(l: Listing) {
    setBusy(l.id); setMsg(null);
    try {
      const q = await api<MarketQuote>(`/market/listings/${l.id}/reserve`, { method: "POST", body: {} });
      await payAndConfirm({ wallet, connection, ixs: marketIxs(q), confirmPath: `/market/listings/${l.id}/confirm`, expectedPayer: q.payer });
      setMsg(t("market.bought")); await load();
    } catch (e) { fail(e); await load().catch(() => undefined); } finally { setBusy(null); }
  }
  async function cancel(id: string) {
    setBusy(id); setMsg(null);
    try { await api(`/market/listings/${id}`, { method: "DELETE" }); await load(); } catch (e) { fail(e); } finally { setBusy(null); }
  }
  async function list(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    try {
      await api("/market/listings", { body: { kind: sell.kind, item_id: sell.id, price_walk: Number(sell.price) } });
      setSell({ ...sell, id: "", price: "" }); setMsg(t("market.published")); await load();
    } catch (err) { fail(err); }
  }

  const sellable = sell.kind === "shoe" ? (inv?.shoes ?? []).map((s) => ({ id: s.id, label: t("profile.shoeLine", { model: s.model_name, n: s.level }) })) : (inv?.collectibles ?? []).map((c) => ({ id: c.id, label: c.name }));
  const field = "h-11 rounded-xl border border-white/25 bg-night px-3 text-white outline-none focus:border-neon";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <Back />
      <h1 className="font-display text-2xl text-white">{t("market.title")}</h1>
      <p className="text-sm text-slate-300">{t("market.intro", { fee: feeMin })}</p>
      {msg && <p role="status" className="text-sm text-legend">{msg}</p>}

      <div className="flex gap-2">
        {([["", t("market.all")], ["shoe", t("market.shoes")], ["collectible", t("market.collectibles")]] as const).map(([k, l]) => (
          <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-10 rounded-full border px-4 text-sm ${kind === k ? "border-neon text-neon" : "border-white/25 text-slate-200"}`}>{l}</button>
        ))}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <li key={l.id} className="glass p-4 text-center">
            {l.shoe && <><ShoeSprite level={l.shoe.level} visual={l.shoe.visual} className="mx-auto w-40" /><p className="text-white">{t("profile.shoeLine", { model: l.shoe.model_name, n: l.shoe.level })}</p></>}
            {l.collectible && <p className="py-8 font-display text-lg text-white">{l.collectible.name}</p>}
            <p className="text-xs text-slate-400">{t("market.by", { name: l.seller.pseudo ?? "?" })}</p>
            <p className="font-display text-xl text-neon">{num(l.price_walk)} $WALK</p>
            <p className="text-xs text-slate-400">{t("market.fee", { fee: (Number(l.fee_lamports) / 1e9).toFixed(3) })}</p>
            {l.mine
              ? <button disabled={busy === l.id} onClick={() => void cancel(l.id)} className="mt-2 text-sm text-red-300 underline underline-offset-4">{t("market.withdrawListing")}</button>
              : <button disabled={busy !== null || l.reserved} onClick={() => void buy(l)} className="mt-2 h-11 w-full rounded-full bg-neon font-display font-bold text-night disabled:bg-white/10 disabled:text-slate-400">
                {busy === l.id ? t("common.paying") : l.reserved ? t("market.reservedBtn") : t("common.buy")}</button>}
          </li>
        ))}
        {listings.length === 0 && <li className="text-slate-300">{t("market.none")}</li>}
      </ul>

      <form onSubmit={list} className="glass space-y-3 p-5">
        <h2 className="font-display text-lg text-white">{t("market.sell")}</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <select aria-label="Type" className={field} value={sell.kind} onChange={(e) => setSell({ kind: e.target.value as "shoe" | "collectible", id: "", price: sell.price })}>
            <option value="shoe">{t("market.typeShoe")}</option><option value="collectible">{t("market.typeColl")}</option>
          </select>
          <select aria-label="Objet" className={`${field} sm:col-span-2`} value={sell.id} onChange={(e) => setSell({ ...sell, id: e.target.value })}>
            <option value="">{t("market.pickItem")}</option>{sellable.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <input aria-label={t("market.price")} inputMode="numeric" placeholder={t("market.price")} className={field} value={sell.price} onChange={(e) => setSell({ ...sell, price: e.target.value.replace(/\D/g, "") })} />
        </div>
        <button disabled={!sell.id || !sell.price} className="h-11 rounded-full bg-neon px-6 font-display font-bold text-night disabled:bg-white/10 disabled:text-slate-400">{t("market.publish")}</button>
      </form>
    </main>
  );
}
