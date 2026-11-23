"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Key, en, msgIndex } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { pt } from "./pt";
import { zh } from "./zh";

export const LANGS = [
  { code: "en", label: "English", locale: "en-US" },
  { code: "fr", label: "Français", locale: "fr-FR" },
  { code: "es", label: "Español", locale: "es-ES" },
  { code: "pt", label: "Português", locale: "pt-PT" },
  { code: "it", label: "Italiano", locale: "it-IT" },
  { code: "zh", label: "中文", locale: "zh-CN" },
] as const;
export type Lang = (typeof LANGS)[number]["code"];

const DICTS: Record<Lang, Record<Key, string>> = { en, fr, es, pt, it, zh };
const STORAGE_KEY = "ns_lang";

export type Params = Record<string, string | number>;
const fill = (s: string, p?: Params) => (p ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? `{${k}}`)) : s);

/** Langue au premier chargement : choix enregistré, sinon langue du navigateur si on la gère, sinon anglais. */
function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGS.some((l) => l.code === saved)) return saved as Lang;
  } catch { /* stockage indisponible */ }
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return (LANGS.find((l) => l.code === nav)?.code ?? "en") as Lang;
}

interface Ctx {
  lang: Lang;
  locale: string;
  setLang: (l: Lang) => void;
  t: (key: Key, params?: Params) => string;
  /** Traduit un texte renvoyé par le serveur ou le package de jeu (par son code d'erreur, sinon par son texte anglais). */
  msg: (text: string | null | undefined, code?: string | null, params?: Params | null) => string;
  num: (n: number) => string;
  date: (d: string | number | Date) => string;
}
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => { setLangState(detect()); }, []); // après le premier rendu : pas de décalage d'hydratation
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignoré */ }
  }, []);

  const value = useMemo<Ctx>(() => {
    const dict = DICTS[lang];
    const locale = LANGS.find((l) => l.code === lang)?.locale ?? "en-US";
    const t: Ctx["t"] = (key, params) => fill(dict[key] ?? en[key], params);
    const msg: Ctx["msg"] = (text, code, params) => {
      const byCode = code ? (`err.${code}` as Key) : null;
      if (byCode && byCode in en) return t(byCode, params ?? undefined);
      const byText = text ? msgIndex[text] : undefined;
      if (byText) return t(byText);
      return text || t("err.generic");
    };
    return { lang, locale, setLang, t, msg, num: (n) => n.toLocaleString(locale), date: (d) => new Date(d).toLocaleString(locale) };
  }, [lang, setLang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n outside I18nProvider");
  return c;
}
