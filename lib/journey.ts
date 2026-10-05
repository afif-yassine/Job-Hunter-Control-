import type { DocumentRecord, Job } from "@/lib/types";
import type { Tone } from "@/lib/labels";

/**
 * The journey of one offer for one student, from "found" to "answer".
 * Stored in jobs.stage; the pipeline `status` only pushes it forward
 * (database trigger sync_job_stage).
 */
export type Stage = "new" | "seen" | "ready" | "applied" | "interview" | "offer" | "rejected" | "dismissed";

export const STAGES: Stage[] = ["new", "seen", "ready", "applied", "interview", "offer", "rejected", "dismissed"];

export const STAGE: Record<Stage, { label: string; tone: Tone; hint: string }> = {
  new: { label: "Nouvelle", tone: "info", hint: "Jamais ouverte" },
  seen: { label: "À préparer", tone: "neutral", hint: "Vue, CV et lettre pas encore créés" },
  ready: { label: "Dossier prêt", tone: "warn", hint: "CV et lettre créés : relis puis postule" },
  applied: { label: "Envoyée", tone: "good", hint: "Candidature envoyée, en attente de réponse" },
  interview: { label: "Entretien", tone: "good", hint: "Entretien prévu ou passé" },
  offer: { label: "Acceptée", tone: "good", hint: "Bravo : l’entreprise a dit oui" },
  rejected: { label: "Refusée", tone: "bad", hint: "Réponse négative" },
  dismissed: { label: "Écartée", tone: "neutral", hint: "Pas pour toi" },
};

/** Columns of "Mon suivi", left to right. */
export const TRACK: { id: string; label: string; stages: Stage[]; empty: string }[] = [
  { id: "seen", label: "À préparer", stages: ["seen"], empty: "Ouvre une offre qui te plaît : elle arrive ici." },
  { id: "ready", label: "Dossier prêt", stages: ["ready"], empty: "Les offres avec CV et lettre créés." },
  { id: "applied", label: "Envoyée", stages: ["applied"], empty: "Clique « J’ai postulé » après l’envoi." },
  { id: "interview", label: "Entretien", stages: ["interview"], empty: "Ajoute la date quand on t’appelle." },
  { id: "answer", label: "Réponse", stages: ["offer", "rejected"], empty: "Acceptées ou refusées." },
];

const FROM_STATUS: Record<string, Stage> = {
  SKIPPED: "dismissed",
  REJECTED: "rejected",
  INTERVIEW: "interview",
  SUBMITTED: "applied",
  CONFIRMED: "applied",
  APPLYING: "applied",
  WAITING_APPROVAL: "ready",
  PREPARED: "ready",
  ANALYZED: "seen",
};

/** Stage of an offer; older rows without one are placed from their status. */
export function stageOf(job: Pick<Job, "stage" | "status">): Stage {
  if (job.stage && (STAGES as string[]).includes(job.stage)) return job.stage as Stage;
  return FROM_STATUS[job.status] ?? "new";
}

export const isSent = (s: Stage) => s === "applied" || s === "interview" || s === "offer" || s === "rejected";

/** The CV and letter written for each offer (latest versions only matter here). */
export function kitsByJob(documents: DocumentRecord[]): Map<string, { cv: boolean; letter: boolean }> {
  const map = new Map<string, { cv: boolean; letter: boolean }>();
  for (const d of documents) {
    if (!d.job_id) continue;
    const kit = map.get(d.job_id) ?? { cv: false, letter: false };
    if (d.kind === "TAILORED_CV") kit.cv = true;
    if (d.kind === "COVER_LETTER") kit.letter = true;
    map.set(d.job_id, kit);
  }
  return map;
}

/** The five milestones shown as dots on a card. */
export function milestones(stage: Stage, kit: { cv: boolean; letter: boolean } | undefined) {
  return [
    { id: "seen", label: "Vue", done: stage !== "new" },
    { id: "cv", label: "CV", done: Boolean(kit?.cv) },
    { id: "letter", label: "Lettre", done: Boolean(kit?.letter) },
    { id: "applied", label: "Envoyée", done: isSent(stage) },
    { id: "interview", label: "Entretien", done: stage === "interview" || stage === "offer" },
  ];
}

const DAY = 86_400_000;
export const FOLLOW_UP_DAYS = 7;

/** Sent a week ago or more, and nothing heard since. */
export function followUpDue(job: Pick<Job, "stage" | "status" | "applied_at" | "stage_at">, now = Date.now()): boolean {
  if (stageOf(job) !== "applied") return false;
  const since = Date.parse(job.applied_at ?? job.stage_at ?? "");
  return Number.isFinite(since) && now - since >= FOLLOW_UP_DAYS * DAY;
}

export type Task = { job: Job; kind: "send" | "follow-up" | "interview" | "prepare"; label: string; when?: string };

/** "À faire aujourd’hui": what moves the search forward, most urgent first. */
export function todayTasks(jobs: Job[], now = Date.now()): Task[] {
  const tasks: Task[] = [];
  for (const job of jobs) {
    const stage = stageOf(job);
    if (job.gone_reason && !isSent(stage)) continue;
    if (stage === "interview" && job.interview_at) {
      const at = Date.parse(job.interview_at);
      if (Number.isFinite(at) && at >= now - DAY && at <= now + 14 * DAY)
        tasks.push({ job, kind: "interview", label: "Prépare ton entretien", when: job.interview_at });
    } else if (stage === "ready") tasks.push({ job, kind: "send", label: "Relis ton dossier et postule" });
    else if (followUpDue(job, now)) tasks.push({ job, kind: "follow-up", label: "Relance l’entreprise" });
  }
  const order: Record<Task["kind"], number> = { interview: 0, send: 1, "follow-up": 2, prepare: 3 };
  tasks.sort((a, b) => order[a.kind] - order[b.kind] || Date.parse(a.when ?? "") - Date.parse(b.when ?? ""));
  return tasks;
}

/** Fields written when the student moves an offer by hand (status kept in step for the pipeline). */
export function stagePatch(stage: Stage, job: Pick<Job, "status" | "match_score">, extra: { interviewAt?: string | null } = {}, now = new Date()) {
  const iso = now.toISOString();
  const patch: Record<string, unknown> = { stage };
  if (stage !== "new") patch.seen_at = iso;
  if (stage === "dismissed") patch.status = "SKIPPED";
  if (stage === "applied") {
    patch.status = "SUBMITTED";
    patch.applied_at = iso;
  }
  if (stage === "interview") {
    patch.status = "INTERVIEW";
    if (extra.interviewAt !== undefined) patch.interview_at = extra.interviewAt;
  }
  if (stage === "rejected") patch.status = "REJECTED";
  if (stage === "offer") patch.status = "CONFIRMED";
  // Brought back from "Écartée": the pipeline may work on it again.
  if ((stage === "seen" || stage === "new") && job.status === "SKIPPED") patch.status = job.match_score === null ? "DISCOVERED" : "ANALYZED";
  return patch;
}

/** One step back, when the student clicked too fast (no saved history: inferred from the offer). */
export function undoPatch(job: Pick<Job, "stage" | "status" | "match_score" | "interview_at">, hasKit: boolean): Record<string, unknown> | null {
  const stage = stageOf(job);
  const back: Partial<Record<Stage, Stage>> = {
    applied: hasKit ? "ready" : "seen",
    interview: "applied",
    offer: job.interview_at ? "interview" : "applied",
    rejected: job.interview_at ? "interview" : "applied",
    ready: "seen",
    dismissed: "seen",
  };
  const to = back[stage];
  if (!to) return null;
  const status: Record<Stage, string> = {
    new: "DISCOVERED",
    seen: job.match_score === null ? "DISCOVERED" : "ANALYZED",
    ready: "WAITING_APPROVAL",
    applied: "SUBMITTED",
    interview: "INTERVIEW",
    offer: "CONFIRMED",
    rejected: "REJECTED",
    dismissed: "SKIPPED",
  };
  const patch: Record<string, unknown> = { stage: to, status: status[to] };
  if (to === "ready" || to === "seen") patch.applied_at = null;
  return patch;
}
