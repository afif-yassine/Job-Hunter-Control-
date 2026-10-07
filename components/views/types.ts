import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentRecord, Job } from "@/lib/types";
import type { Stage } from "@/lib/journey";
import type { Data } from "@/components/use-dashboard-data";
import type { SystemStatus } from "@/components/use-status";
import type { usePipeline } from "@/components/use-pipeline";
import type { DocumentDialogState } from "@/components/document-tools";
import type { AdminOverview } from "@/lib/admin/overview";

export type View =
  | "home"
  | "jobs"
  | "track"
  | "documents"
  | "questions"
  | "more"
  | "applications"
  | "activity"
  | "settings"
  | "admin"
  | "roadmap";

export type JobFilter = "new" | "all" | "best" | "review" | "gone";

export type ReviewAction = "keep" | "merge" | "dismiss" | "applied_elsewhere";

export type Tone = "good" | "bad" | "info";

/** Everything a view needs from the dashboard shell. */
export type Ctx = {
  data: Data;
  supabase: SupabaseClient | null;
  status: SystemStatus | null;
  statusFailed: boolean;
  refreshStatus: () => Promise<void>;
  pipeline: ReturnType<typeof usePipeline>;
  busy: string;
  userEmail: string;
  go: (view: View, filter?: JobFilter) => void;
  notify: (text: string, tone?: Tone) => void;
  reload: () => Promise<void>;
  /** Fixed admin data for the /demo page. */
  adminDemo?: AdminOverview;
  /** Whether a CV profile is saved (undefined while unknown: nothing is blocked). */
  hasProfile: boolean | undefined;
  refreshProfile: () => Promise<void>;
  jobFilter: JobFilter;
  setJobFilter: (filter: JobFilter) => void;
  /** Opens the offer panel (and marks the offer as seen). */
  openOffer: (job: Job) => void;
  act: {
    /** Analyse when needed, then write the CV and letter. */
    prepareKit: (job: Job) => Promise<void>;
    moveStage: (job: Job, stage: Stage, extra?: { interviewAt?: string | null }) => Promise<void>;
    undoStage: (job: Job) => Promise<void>;
    saveNotes: (job: Job, notes: string) => Promise<void>;
    analyze: (job: Job) => Promise<void>;
    generate: (job: Job) => Promise<void>;
    review: (job: Job, action: ReviewAction, platform?: string) => Promise<void>;
    /** "Offre plus disponible" (false) or "Toujours en ligne" (true). */
    availability: (job: Job, available: boolean) => Promise<void>;
    approve: (doc: DocumentRecord) => Promise<void>;
    upload: (doc: DocumentRecord) => Promise<void>;
    prepare: (applicationId: string) => Promise<void>;
    pasteDescription: (job: Job) => void;
    addJob: () => void;
    markRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    openDocument: (state: NonNullable<DocumentDialogState>) => void;
  };
};
