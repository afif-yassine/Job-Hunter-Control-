"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileAnswer, Question } from "@/lib/types";
import { classifyQuestion, type QuestionSpec } from "@/lib/questions";

type Group = { spec: QuestionSpec; rows: Question[] };

const OTHER = "__other__";

function groupOpen(rows: Question[]): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows.filter((r) => !r.approved)) {
    const spec = classifyQuestion({
      question: row.question,
      category: row.category,
      options: row.options ?? undefined,
      key: row.question_key,
    });
    const g = groups.get(spec.key);
    if (g) g.rows.push(row);
    else groups.set(spec.key, { spec, rows: [row] });
  }
  return [...groups.values()];
}

export function openQuestionCount(rows: Question[]) {
  return groupOpen(rows).length;
}

function companies(rows: Question[]) {
  const names = rows
    .map((r) => r.applications?.jobs?.company)
    .filter((n): n is string => Boolean(n));
  return [...new Set(names)];
}

function QuestionCard({
  group,
  onAnswer,
  busy,
}: {
  group: Group;
  onAnswer: (
    group: Group,
    answer: string,
    remember: boolean,
    expiresAt: string | null,
  ) => Promise<void>;
  busy: boolean;
}) {
  const { spec, rows } = group;
  const [value, setValue] = useState("");
  const [other, setOther] = useState("");
  const [expires, setExpires] = useState("");
  const [remember, setRemember] = useState(spec.remember);
  const names = companies(rows);
  const final = value === OTHER ? other.trim() : value.trim();
  const options = spec.options ?? [];

  return (
    <article className="qcard">
      <div className="qhead">
        <div>
          <span className="eyebrow">{spec.label}</span>
          <h3>{rows[0].question}</h3>
          {spec.hint && <p className="muted">{spec.hint}</p>}
          {rows.length > 1 && (
            <p className="muted">
              Même question dans {rows.length} candidature(s)
              {names.length ? ` : ${names.join(", ")}` : ""}. Une seule réponse
              suffit.
            </p>
          )}
          {rows.length === 1 && names.length > 0 && (
            <p className="muted">Candidature : {names[0]}</p>
          )}
        </div>
        {spec.sensitive && <span className="status">SENSIBLE</span>}
      </div>

      {spec.type === "ack" ? (
        <div className="toolbar">
          <button
            className="btn small"
            disabled={busy}
            onClick={() => void onAnswer(group, "Traité", false, null)}
          >
            Marquer comme traité
          </button>
        </div>
      ) : (
        <form
          className="qform"
          onSubmit={(e) => {
            e.preventDefault();
            if (final) void onAnswer(group, final, remember, expires || null);
          }}
        >
          {spec.type === "textarea" ? (
            <textarea
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ta réponse"
            />
          ) : spec.type === "date" ? (
            <input type="date" value={value} onChange={(e) => setValue(e.target.value)} />
          ) : spec.type === "select" || spec.type === "boolean" ? (
            <>
              {spec.type === "boolean" && options.length <= 2 ? (
                <div className="toolbar">
                  {options.map((o) => (
                    <label key={o} className="radio">
                      <input
                        type="radio"
                        name={`q-${spec.key}`}
                        checked={value === o}
                        onChange={() => setValue(o)}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              ) : (
                <select value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">Choisir…</option>
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                  {spec.allowOther && <option value={OTHER}>Autre…</option>}
                </select>
              )}
              {value === OTHER && (
                <input
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  placeholder="Précise ta réponse"
                />
              )}
            </>
          ) : (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ta réponse"
            />
          )}
          {spec.expires && (
            <label className="inline">
              <span className="muted">Valable jusqu’au (optionnel)</span>
              <input
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </label>
          )}
          <div className="toolbar qfoot">
            <label className="check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Mémoriser pour les prochaines candidatures
            </label>
            <button className="btn small" disabled={busy || !final}>
              Enregistrer
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

function SavedAnswers({
  supabase,
  version,
  notify,
}: {
  supabase: SupabaseClient | null;
  version: number;
  notify: (m: string) => void;
}) {
  const [rows, setRows] = useState<ProfileAnswer[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("profile_answers")
      .select("*")
      .order("updated_at", { ascending: false });
    setRows((data || []) as ProfileAnswer[]);
  }, [supabase]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load, version]);

  async function save(row: ProfileAnswer) {
    if (!supabase || !draft.trim()) return;
    const { error } = await supabase
      .from("profile_answers")
      .update({ answer: draft.trim(), updated_at: new Date().toISOString() })
      .eq("id", row.id);
    notify(error ? `Erreur : ${error.message}` : "Réponse mémorisée mise à jour.");
    setEditing(null);
    await load();
  }
  async function forget(row: ProfileAnswer) {
    if (!supabase) return;
    const { error } = await supabase.from("profile_answers").delete().eq("id", row.id);
    notify(
      error
        ? `Erreur : ${error.message}`
        : "Réponse oubliée : la question sera reposée la prochaine fois.",
    );
    await load();
  }

  if (!rows.length) return null;
  return (
    <section className="saved">
      <h3>Réponses mémorisées ({rows.length})</h3>
      <p className="muted">
        Réutilisées automatiquement : l’agent ne te repose pas ces questions.
      </p>
      <table>
        <thead>
          <tr>
            <th>Sujet</th>
            <th>Réponse</th>
            <th>Validité</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const expired = r.expires_at && new Date(r.expires_at) <= new Date();
            return (
              <tr key={r.id}>
                <td>
                  {r.label}
                  {r.sensitive && <span className="status">sensible</span>}
                </td>
                <td>
                  {editing === r.id ? (
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    r.answer
                  )}
                </td>
                <td>
                  {r.expires_at
                    ? `${expired ? "Expirée le " : "Jusqu’au "}${new Date(r.expires_at).toLocaleDateString("fr-FR")}`
                    : "—"}
                </td>
                <td>
                  <div className="toolbar">
                    {editing === r.id ? (
                      <>
                        <button className="btn small" onClick={() => void save(r)}>
                          OK
                        </button>
                        <button
                          className="btn secondary small"
                          onClick={() => setEditing(null)}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn secondary small"
                          onClick={() => {
                            setEditing(r.id);
                            setDraft(r.answer);
                          }}
                        >
                          Modifier
                        </button>
                        <button
                          className="btn secondary small"
                          onClick={() => void forget(r)}
                        >
                          Oublier
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function QuestionsPanel({
  rows,
  supabase,
  reload,
  notify,
}: {
  rows: Question[];
  supabase: SupabaseClient | null;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const groups = useMemo(() => groupOpen(rows), [rows]);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const answered = rows.filter((r) => r.approved);

  async function answer(
    group: Group,
    text: string,
    remember: boolean,
    expiresAt: string | null,
  ) {
    setBusy(true);
    try {
      // Remembered answers are propagated by the server to every identical
      // question; otherwise each row of the group is answered one by one.
      const targets = remember ? [group.rows[0]] : group.rows;
      let warning: string | null = null;
      let propagated = 0;
      for (const row of targets) {
        const r = await fetch(`/api/questions/${row.id}/answer`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answer: text, remember, expires_at: expiresAt }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "Enregistrement impossible");
        warning = body.warning || warning;
        propagated += body.propagated || 0;
      }
      notify(
        warning ||
          (remember
            ? `Réponse enregistrée et mémorisée${propagated ? ` · appliquée à ${propagated} autre(s) question(s)` : ""}.`
            : "Réponse enregistrée."),
      );
      setVersion((v) => v + 1);
      await reload();
    } catch (e) {
      notify(e instanceof Error ? `Erreur : ${e.message}` : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {groups.length ? (
        <div className="feed">
          {groups.map((g) => (
            <QuestionCard
              key={`${g.spec.key}-${g.rows.map((r) => r.id).join("")}`}
              group={g}
              onAnswer={answer}
              busy={busy}
            />
          ))}
        </div>
      ) : (
        <div className="empty">Aucune question en attente.</div>
      )}

      <SavedAnswers supabase={supabase} version={version} notify={notify} />

      {answered.length > 0 && (
        <details className="saved">
          <summary>Questions déjà répondues ({answered.length})</summary>
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Candidature</th>
                <th>Réponse</th>
                <th>Origine</th>
              </tr>
            </thead>
            <tbody>
              {answered.map((q) => (
                <tr key={q.id}>
                  <td>{q.question}</td>
                  <td>{q.applications?.jobs?.company || "—"}</td>
                  <td>{q.answer}</td>
                  <td>
                    <span className="status">
                      {q.auto_answered ? "MÉMOIRE" : "MANUELLE"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
