"use client";

import { useEffect, useRef, useState } from "react";
import { LANGS, type Lang, useI18n } from "@/lib/i18n";
import { Flag } from "./Flag";

/** Sélecteur de langue avec drapeaux, en haut à droite de toutes les pages. */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={t("common.language")} onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-full border border-white/25 bg-night/90 pl-3 pr-3 text-sm text-slate-100 outline-none backdrop-blur hover:border-neon focus-visible:border-neon">
        <Flag code={cur.code} /><span>{cur.label}</span><span aria-hidden className="text-xs text-slate-400">▾</span>
      </button>
      {open && (
        <ul role="listbox" aria-label={t("common.language")} className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-white/25 bg-night/95 py-1 shadow-xl backdrop-blur">
          {LANGS.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button type="button" onClick={() => { setLang(l.code as Lang); setOpen(false); }}
                className={`flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm hover:bg-white/10 ${l.code === lang ? "text-neon" : "text-slate-100"}`}>
                <Flag code={l.code} /><span>{l.label}</span>{l.code === lang && <span aria-hidden className="ml-auto">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
