"use client";
import { useMemo, useState } from "react";
import { CircleAlert, CircleCheck, Clock, LoaderCircle, PauseCircle } from "lucide-react";
import { Chip, Empty, PageHead } from "@/components/ui";
import { cleanRaw, explainError } from "@/lib/errors";
import { runStatus, runType, timeAgo, type Tone } from "@/lib/labels";
import { runSummary } from "@/lib/run-summary";
import type { AgentRun } from "@/lib/types";
import type { Ctx } from "./types";

type Entry = { key: string; run: AgentRun; count: number };

/** Identical consecutive failures ("navigateur manquant" ×7) become one line. */
function group(runs: AgentRun[]): Entry[] {
  const out: Entry[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    if (
      last &&
      last.run.run_type === run.run_type &&
      last.run.status === run.status &&
      run.status === "FAILED" &&
      cleanRaw(last.run.error_message || "") === cleanRaw(run.error_message || "")
    )
      last.count += 1;
    else out.push({ key: run.id, run, count: 1 });
  }
  return out;
}

const ICON: Record<Tone, typeof CircleCheck> = {
  good: CircleCheck,
  bad: CircleAlert,
  warn: PauseCircle,
  info: LoaderCircle,
  neutral: Clock,
};

export function ActivityView({ ctx }: { ctx: Ctx }) {
  const [tab, setTab] = useState<"journal" | "notifications">("journal");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const { data } = ctx;
  const unread = data.notifications.filter((n) => !n.read_at).length;
  const problems = data.runs.filter((r) => r.status === "FAILED").length;

  const entries = useMemo(
    () => group(data.runs.filter((r) => (onlyProblems ? r.status === "FAILED" : true))),
    [data.runs, onlyProblems],
  );

  return (
    <>
      <PageHead title="Activité" subtitle="Ce que l’assistant a fait, et ce qui a coincé." />
      <div className="filters" role="tablist">
        <button role="tab" aria-selected={tab === "journal"} className={tab === "journal" ? "pill active" : "pill"} onClick={() => setTab("journal")}>
          Journal
        </button>
        <button
          role="tab"
          aria-selected={tab === "notifications"}
          className={tab === "notifications" ? "pill active" : "pill"}
          onClick={() => setTab("notifications")}
        >
          Notifications {unread > 0 && <span className="count">{unread}</span>}
        </button>
      </div>

      {tab === "journal" ? (
        <>
          {data.runs.length > 0 && (
            <label className="check switch">
              <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
              Afficher seulement les problèmes ({problems})
            </label>
          )}
          {entries.length === 0 ? (
            <Empty
              title={onlyProblems ? "Aucun problème" : "Rien pour l’instant"}
              text={onlyProblems ? "Tout s’est bien passé." : "Chaque recherche et chaque lecture de formulaire apparaîtra ici."}
            />
          ) : (
            <ol className="timeline">
              {entries.map((entry) => (
                <RunEntry key={entry.key} entry={entry} ctx={ctx} />
              ))}
            </ol>
          )}
        </>
      ) : data.notifications.length === 0 ? (
        <Empty title="Aucune notification" text="Tu seras prévenu ici quand des documents sont prêts ou qu’une réponse est attendue." />
      ) : (
        <>
          {unread > 0 && (
            <button className="btn ghost small" onClick={() => void ctx.act.markAllRead()}>
              Tout marquer comme lu
            </button>
          )}
          <div className="cards">
            {data.notifications.map((n) => (
              <article key={n.id} className={`card notice ${n.read_at ? "read" : "unread"}`}>
                <div>
                  <h3>{n.title}</h3>
                  <p className="muted">{n.message}</p>
                  <span className="muted small-text">{timeAgo(n.created_at)}</span>
                </div>
                <div className="toolbar">
                  {n.action_url && (
                    <a className="btn secondary small" href={n.action_url} target="_blank" rel="noreferrer">
                      Ouvrir
                    </a>
                  )}
                  {!n.read_at && (
                    <button className="btn small" onClick={() => void ctx.act.markRead(n.id)}>
                      Lu
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function RunEntry({ entry, ctx }: { entry: Entry; ctx: Ctx }) {
  const { run, count } = entry;
  const status = runStatus(run.status);
  const Icon = ICON[status.tone];
  const raw = run.error_message ? cleanRaw(run.error_message) : "";
  const explained = raw ? explainError(raw) : null;
  const applicationId = typeof run.counters?.applicationId === "string" ? run.counters.applicationId : null;
  const app = applicationId ? ctx.data.apps.find((a) => a.id === applicationId) : null;
  const summary = runSummary(run);
  const paused = run.status === "PAUSED" && Number(run.counters?.questions) > 0;

  return (
    <li className={`entry ${status.tone}`}>
      <span className="entry-icon">
        <Icon size={18} className={run.status === "RUNNING" ? "spin" : ""} aria-hidden />
      </span>
      <div className="entry-body">
        <div className="entry-head">
          <strong>
            {runType(run.run_type)}
            {app?.jobs?.company ? ` · ${app.jobs.company}` : ""}
          </strong>
          <Chip tone={status.tone}>
            {status.label}
            {count > 1 ? ` ×${count}` : ""}
          </Chip>
        </div>
        <span className="muted small-text" title={new Date(run.created_at).toLocaleString("fr-FR")}>
          {timeAgo(run.created_at)}
        </span>
        {summary && <p>{summary}</p>}
        {paused && (
          <p>
            Une question attend ta réponse.{" "}
            <button className="linkbtn" onClick={() => ctx.go("questions")}>
              Répondre
            </button>
          </p>
        )}
        {explained && (
          <div className="entry-problem">
            <p>
              <strong>{explained.title}</strong>
              {explained.hint && <> — {explained.hint}</>}
            </p>
            <div className="toolbar">
              {applicationId && run.run_type.startsWith("PLAYWRIGHT") && (
                <button className="btn small" disabled={Boolean(ctx.busy)} onClick={() => void ctx.act.prepare(applicationId)}>
                  Réessayer
                </button>
              )}
            </div>
            {raw && raw !== explained.title && (
              <details className="why">
                <summary>Détails techniques</summary>
                <pre>{raw.slice(0, 900)}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
