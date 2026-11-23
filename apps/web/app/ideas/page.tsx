"use client";

import { useCallback, useEffect, useState } from "react";
import { Back } from "@/components/Back";
import { useSession } from "@/components/SessionProvider";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Idea { id: string; body: string; status: "open" | "planned" | "done" | "hidden"; votes: number; team: boolean; mine: boolean }
const BADGE: Record<string, string> = { planned: "border-legend/60 text-legend", done: "border-neon/60 text-neon", open: "border-white/20 text-slate-400", hidden: "border-red-400/50 text-red-300" };

/** Page « Idées » : propositions d'amélioration de l'équipe et des joueurs, avec votes. */
export default function IdeasPage() {
  const { me } = useSession();
  const { t, msg: tr, num } = useI18n();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ ideas: Idea[] }>("/ideas").then((r) => setIdeas(r.ideas)).catch(() => undefined), []);
  useEffect(() => { void load(); }, [load]);

  const fail = (e: unknown) => setNote(e instanceof ApiError ? tr(e.message, e.code, e.params) : t("common.error"));

  async function vote(id: string) {
    if (!me) { setNote(t("ideas.login")); return; }
    try { await api(`/ideas/${id}/vote`, { body: {} }); await load(); } catch (e) { fail(e); }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setNote(null);
    try { await api("/ideas", { body: { body: text } }); setText(""); setNote(t("ideas.sent")); await load(); } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function setStatus(id: string, status: string) {
    try { await api(`/admin/ideas/${id}`, { body: { status } }); await load(); } catch (e) { fail(e); }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8">
      <Back />
      <h1 className="font-display text-3xl text-white">{t("ideas.title")}</h1>
      <p className="text-slate-300">{t("ideas.intro")}</p>

      <form onSubmit={send} className="glass space-y-3 p-5">
        <label htmlFor="idea" className="font-display text-white">{t("ideas.add")}</label>
        {me ? (
          <>
            <textarea id="idea" value={text} onChange={(e) => setText(e.target.value)} minLength={10} maxLength={400} rows={3} required placeholder={t("ideas.placeholder")}
              className="w-full rounded-xl border border-white/25 bg-night p-3 text-white outline-none focus:border-neon" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">{t("ideas.hint")} · {text.length}/400</span>
              <button disabled={busy || text.trim().length < 10} className="min-h-11 rounded-full bg-neon px-6 text-sm font-semibold text-night disabled:opacity-50">{t("ideas.send")}</button>
            </div>
          </>
        ) : <p className="text-sm text-slate-300">{t("ideas.login")}</p>}
      </form>
      {note && <p role="status" className="text-sm text-legend">{note}</p>}

      <ul className="space-y-3">
        {ideas.length === 0 && <li className="text-sm text-slate-400">{t("ideas.empty")}</li>}
        {ideas.map((i) => (
          <li key={i.id} className="glass flex items-start gap-4 p-4">
            <button onClick={() => void vote(i.id)} aria-pressed={i.mine} aria-label={i.mine ? t("ideas.voted") : t("ideas.vote")}
              className={`flex min-h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border text-sm transition ${i.mine ? "border-neon bg-neon/15 text-neon" : "border-white/25 text-slate-200 hover:border-neon"}`}>
              <span aria-hidden>▲</span><span className="font-display">{num(i.votes)}</span>
            </button>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-words text-slate-100">{i.body}</p>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`rounded-full border px-2 py-0.5 ${BADGE[i.status]}`}>{t(`ideas.status.${i.status === "hidden" ? "open" : i.status}` as "ideas.status.open")}</span>
                {i.team && <span className="text-slate-400">{t("ideas.team")}</span>}
                {me?.is_admin && (
                  <select aria-label="Status" value={i.status} onChange={(e) => void setStatus(i.id, e.target.value)} className="rounded-lg border border-white/25 bg-night px-2 py-1 text-slate-200">
                    <option value="open">open</option><option value="planned">planned</option><option value="done">done</option><option value="hidden">hidden</option>
                  </select>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
