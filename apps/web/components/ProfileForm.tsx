"use client";

import { AVATARS, handleError, normalizeHandle } from "@walk/game";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "./Avatar";
import { useSession } from "./SessionProvider";

/** Character creation right after the first sign-in: a @name and one of the prepared avatars. */
export function ProfileForm() {
  const { refresh } = useSession();
  const { t, msg } = useI18n();
  const [pseudo, setPseudo] = useState("@");
  const [avatar, setAvatar] = useState<number | null>(null);
  const [hint, setHint] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Checks the name 0.5 s after the last keystroke.
  useEffect(() => {
    if (pseudo.length < 2) return setHint(null);
    const local = handleError(pseudo);
    if (local) return setHint({ ok: false, text: msg(local) });
    const timer = window.setTimeout(() => {
      api<{ available: boolean; reason: string | null }>(`/profile/check?pseudo=${encodeURIComponent(pseudo)}`)
        .then((r) => setHint(r.available ? { ok: true, text: t("create.nameOk") } : { ok: false, text: r.reason ? msg(r.reason) : t("create.nameNo") }))
        .catch(() => setHint(null));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [pseudo, t, msg]);

  const ready = !handleError(pseudo) && hint?.ok && avatar !== null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError(null);
    try {
      await api("/me/profile", { method: "PUT", body: { pseudo: normalizeHandle(pseudo), avatar } });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? msg(err.message, err.code, err.params) : t("create.fail"));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="glass nw-rise mx-auto w-full max-w-md space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl text-white">{t("create.title")}</h1>
        <p className="mt-1 text-sm text-slate-300">{t("create.final")}</p>
      </div>
      <div>
        <label htmlFor="pseudo" className="text-sm text-slate-200">{t("create.name")}</label>
        <input id="pseudo" value={pseudo} onChange={(e) => setPseudo(e.target.value.toLowerCase().replace(/[^@a-z0-9_]/g, ""))}
          maxLength={21} autoComplete="off" autoCapitalize="none" spellCheck={false}
          className="mt-1 h-12 w-full rounded-xl border border-white/25 bg-black/30 px-4 font-display text-lg text-white outline-none focus:border-neon" />
        {hint && <p role="status" className={`mt-1 text-sm ${hint.ok ? "text-neon" : "text-red-300"}`}>{hint.text}</p>}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm text-slate-200">{t("create.pick")}</legend>
        <div className="grid grid-cols-4 gap-2">
          {AVATARS.map((a, i) => (
            <button type="button" key={a.name} onClick={() => setAvatar(i)} aria-pressed={avatar === i} aria-label={`${a.name}, ${a.role}`}
              className={`rounded-2xl border-2 p-0.5 transition ${avatar === i ? "border-neon shadow-neon" : "border-white/20 hover:border-white/50"}`}>
              <Avatar face={i} />
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">{avatar === null ? t("create.note") : `${AVATARS[avatar]?.name} · ${AVATARS[avatar]?.role}`}</p>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={!ready || busy} className="h-14 w-full rounded-full bg-neon font-display text-lg font-black text-night shadow-neon disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 disabled:shadow-none">
        {busy ? t("create.saving") : t("create.confirm")}
      </button>
    </form>
  );
}
