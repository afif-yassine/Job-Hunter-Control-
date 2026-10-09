import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentRecord, Job } from "@/lib/types";
import type { Stage } from "@/lib/journey";
import type { Data } from "@/components/use-dashboard-data";
import type { SystemStatus } from "@/components/use-status";
import type { usePipeline } from "@/components/use-pipeline";
import type { DocumentDialogState } from "@/components/document-tools";
import type { AdminOverview } from "@/lib/admin/overview";
import type { ProfileSummary } from "@/lib/profile-store";
import type { AccountInfo } from "@/components/use-account";
import type { UnlockState } from "@/components/unlock";

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
  | "admin";

export type SummarizeResult = "ok" | "gone" | "failed";

/** What came of "Créer mon CV et ma lettre". "locked": the server refused because the offer is not in the student's selection. "quota": the free kits of the month are used. */
export type KitResult = "ok" | "locked" | "quota" | "failed";

export type JobFilter ="new" | "all" | "best" | "review" | "gone";

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
  /** The address shown everywhere: the account's own (/api/account) once loaded, else the token's. */
  userEmail: string;
  /** The signed-in account as the server reads it now (null until loaded). */
  account: AccountInfo | null;
  /** Which offers can be worked on. Nothing is locked unless the state is "locking" (see components/unlock.ts). */
  unlock: UnlockState;
  /** Reads the day's selection again. */
  refreshSelection: () => void;
  go: (view: View, filter?: JobFilter) => void;
  notify: (text: string, tone?: Tone) => void;
  reload: () => Promise<void>;
  /** The pricing page exists (PRICING_PAGE is not 0): links to it may be shown. */
  pricing: boolean;
  /** Fixed admin data for the /demo page. */
  adminDemo?: AdminOverview;
  /** The demo page: nothing is read from the account. */
  demo: boolean;
  /** Whether a CV profile is saved (undefined while unknown: nothing is blocked). */
  hasProfile: boolean | undefined;
  /** What the saved CV holds (undefined: loading or unreadable; null: no profile yet). */
  profileSummary: ProfileSummary | null | undefined;
  /** The profile could not be read: shown instead of an endless "Chargement…". */
  profileFailed: boolean;
  refreshProfile: () => Promise<void>;
  /** When the shared catalogue was last checked for this student in this browser session (null: not yet). */
  catalogueRefreshedAt: string | null;
  jobFilter: JobFilter;
  setJobFilter: (filter: JobFilter) => void;
  /** Opens the offer panel (and marks the offer as seen). */
  openOffer: (job: Job) => void;
  act: {
    /** Analyse when needed, then write the CV and letter. */
    prepareKit: (job: Job) => Promise<KitResult>;
    moveStage: (job: Job, stage: Stage, extra?: { interviewAt?: string | null }) => Promise<void>;
    undoStage: (job: Job) => Promise<void>;
    saveNotes: (job: Job, notes: string) => Promise<void>;
    analyze: (job: Job) => Promise<void>;
    /**
     * Writes the short summary when an offer is opened: no toast and no global lock.
     * "gone": the server refused because the offer is closed for everybody (code GONE).
     */
    summarize: (job: Job) => Promise<SummarizeResult>;
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
