"use client";

import { Back } from "@/components/Back";
import { useI18n } from "@/lib/i18n";
import { CONTACT_EMAIL } from "@/lib/site";

const SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"] as const;

export default function PrivacyPage() {
  const { t } = useI18n();
  const contact = CONTACT_EMAIL || t("priv.contactDefault");
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Back />
      <h1 className="font-display text-3xl font-black text-white">{t("priv.title")}</h1>
      <p className="text-sm text-slate-400">{t("priv.updated")}</p>
      {SECTIONS.map((k) => (
        <section key={k} className="glass space-y-2 p-5">
          <h2 className="font-display text-lg text-neon">{t(`priv.${k}.t` as "priv.s1.t")}</h2>
          <p className="text-sm leading-relaxed text-slate-300">{t(`priv.${k}.p` as "priv.s1.p", { contact })}</p>
        </section>
      ))}
    </main>
  );
}
