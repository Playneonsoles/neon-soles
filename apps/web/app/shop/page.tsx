"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { Back } from "@/components/Back";
import { ShoeSprite } from "@/components/ShoeSprite";
import { useSession } from "@/components/SessionProvider";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { payAndConfirm, shopIxs, type ShopQuote } from "@/lib/pay";

interface Item { level: number; price_walk: number; visual: { color: string; effects: never[] } }

export default function ShopPage() {
  const { me, refresh } = useSession();
  const { t, msg: tr, num } = useI18n();
  const wallet = useWallet(); const { connection } = useConnection();
  const [items, setItems] = useState<Item[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { api<{ enabled: boolean; items: Item[] }>("/shop/shoes").then((r) => { setItems(r.items); setEnabled(r.enabled); }).catch(() => undefined); }, []);
  if (!me) return <main className="p-8 text-slate-300">{t("common.needLogin")}</main>;

  async function buy(level: number) {
    setBusy(level); setMsg(null);
    try {
      const q = await api<ShopQuote & { order_id: string }>(`/shop/shoes/${level}/order`, { method: "POST", body: {} });
      await payAndConfirm({ wallet, connection, ixs: shopIxs(q), confirmPath: `/shop/orders/${q.order_id}/confirm`, expectedPayer: q.payer });
      setMsg(t("shop.bought", { n: level })); await refresh();
    } catch (e) { setMsg(e instanceof ApiError ? tr(e.message, e.code, e.params) : t("common.cancelled")); }
    finally { setBusy(null); }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Back />
      <h1 className="font-display text-2xl text-white">{t("shop.title")}</h1>
      <p className="text-sm text-slate-300">{t("shop.intro")} <a className="underline" href="/market">{t("shop.introLink")}</a>.</p>
      {!enabled && <p className="text-legend">{t("shop.closed")}</p>}
      {msg && <p role="status" className="text-sm text-legend">{msg}</p>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.level} className="glass p-4 text-center">
            <ShoeSprite level={i.level} visual={i.visual} className="mx-auto w-48" />
            <p className="font-display text-lg text-white">{t("common.level", { n: i.level })}</p>
            <p className="font-display text-2xl text-neon">{num(i.price_walk)} <span className="text-sm text-slate-300">$WALK</span></p>
            <button disabled={!enabled || busy !== null} onClick={() => void buy(i.level)} className="mt-3 h-12 w-full rounded-full bg-neon font-display font-bold text-night disabled:bg-white/10 disabled:text-slate-400">
              {busy === i.level ? t("common.paying") : t("common.buy")}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
