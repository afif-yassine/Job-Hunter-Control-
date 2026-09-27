import type { Data } from "@/components/use-dashboard-data";
import type { SystemStatus } from "@/components/use-status";

/** Fake data for screenshots (`/demo`, enabled only with DEMO_MODE=1). */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const breakdown = {
  total: 88,
  verified_strengths: [
    "Alternance en développement : ton profil correspond exactement au contrat recherché",
    "Python et IA générative présents dans tes projets vérifiés",
    "Paris : même zone géographique",
  ],
  gaps: ["Kubernetes n’apparaît pas dans ton profil vérifié"],
};

export const demoData: Data = {
  jobs: [
    { id: "j1", company: "Doctolib", title: "Alternant développeur IA", contract_type: "Alternance", location: "Paris (75)", source_url: "https://www.linkedin.com/jobs/view/1", official_url: "https://www.linkedin.com/jobs/view/1", description: "…", match_score: 88, score_breakdown: breakdown, status: "WAITING_APPROVAL", publication_date: null, source_platform: "jsearch:LinkedIn", created_at: ago(90) },
    { id: "j2", company: "Airbus", title: "Stagiaire data engineer", contract_type: "Stage", location: "Toulouse", source_url: "https://www.indeed.com/viewjob?jk=2", description: "…", match_score: 84, score_breakdown: { ...breakdown, total: 84 }, status: "ANALYZED", publication_date: null, source_platform: "jsearch:Indeed", created_at: ago(95) },
    { id: "j3", company: "Alan", title: "Développeur full-stack en alternance", contract_type: "Alternance", location: "Paris (75)", source_url: "https://www.welcometothejungle.com/fr/jobs/3", description: "…", match_score: 67, status: "ANALYZED", publication_date: null, source_platform: "jsearch:Welcome to the Jungle", created_at: ago(300) },
    { id: "j4", company: "Entreprise non communiquée", title: "Alternance développeur web", contract_type: "Alternance", location: "Nanterre (92)", source_url: "https://candidat.francetravail.fr/offres/recherche/detail/4", description: null, match_score: null, status: "DISCOVERED", publication_date: "2026-09-18", source_platform: "francetravail", created_at: ago(20) },
    { id: "j5", company: "Capgemini", title: "Alternant ingénieur data & IA", contract_type: "Alternance", location: "Paris La Défense", source_url: "https://www.hellowork.com/fr-fr/emplois/5.html", description: "Missions : …", match_score: null, status: "DISCOVERED", publication_date: null, source_platform: "adzuna", created_at: ago(20) },
  ],
  apps: [
    { id: "a1", job_id: "j1", status: "WAITING_APPROVAL", platform: "linkedin", created_at: ago(80), jobs: { company: "Doctolib", title: "Alternant développeur IA" } },
    { id: "a2", job_id: "j2", status: "WAITING_APPROVAL", platform: "indeed", created_at: ago(70), jobs: { company: "Airbus", title: "Stagiaire data engineer" } },
  ],
  questions: [
    { id: "q1", application_id: "a1", question: "Avez-vous le permis B ?", category: "logistics", answer: null, blocking: true, approved: false, created_at: ago(80), applications: { jobs: { company: "Doctolib", title: "Alternant développeur IA" } } },
  ],
  documents: [
    { id: "d1", job_id: "j1", kind: "TAILORED_CV", filename: "CV_Doctolib.pdf", version: 1, approved: false, storage_path: null, created_at: ago(85), jobs: { company: "Doctolib", title: "Alternant développeur IA" } },
    { id: "d2", job_id: "j1", kind: "COVER_LETTER", filename: "Lettre_Doctolib.pdf", version: 2, approved: true, storage_path: null, created_at: ago(84), based_on_document_id: null, jobs: { company: "Doctolib", title: "Alternant développeur IA" } },
    { id: "d3", job_id: "j2", kind: "TAILORED_CV", filename: "CV_Airbus.pdf", version: 1, approved: true, storage_path: "https://drive.google.com/", created_at: ago(70), jobs: { company: "Airbus", title: "Stagiaire data engineer" } },
  ],
  notifications: [
    { id: "n1", notification_type: "PIPELINE_DONE", title: "Recherche terminée", message: "12 nouvelle(s) offre(s), 2 très bonne(s) (≥ 80), 2 dossier(s) prêt(s).", action_url: null, read_at: null, created_at: ago(88) },
    { id: "n2", notification_type: "DOCUMENTS_READY", title: "Doctolib · documents prêts (88/100)", message: "2 document(s) rédigé(s), 1 question(s) à valider.", action_url: null, read_at: ago(60), created_at: ago(85) },
  ],
  runs: [
    { id: "r1", run_type: "PIPELINE", status: "COMPLETED", created_at: ago(88), error_message: null, counters: { found: 41, inserted: 12, analyzed: 12, strong: 2, generated: 2, prepared: 0, needsDescription: 1, issues: 2 } },
    { id: "r2", run_type: "PLAYWRIGHT_PREPARE", status: "FAILED", created_at: ago(1400), error_message: "browserType.launch: Executable doesn't exist at /ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell ╔═════╗ Looks like Playwright was just updated to 1.63.0. Please update docker image", counters: { applicationId: "a1" } },
    { id: "r3", run_type: "PLAYWRIGHT_PREPARE", status: "FAILED", created_at: ago(1460), error_message: "browserType.launch: Executable doesn't exist at /ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell ╔═════╗ Looks like Playwright was just updated to 1.63.0. Please update docker image", counters: { applicationId: "a1" } },
    { id: "r4", run_type: "PLAYWRIGHT_PREPARE", status: "COMPLETED", created_at: ago(2900), error_message: null, counters: { applicationId: "a2", fields: 14, questions: 1 } },
  ],
};

export const demoStatus: SystemStatus = {
  applicationMode: "PREPARE_ONLY",
  safeMode: true,
  explicitModeVariable: true,
  gemini: true,
  drive: true,
  worker: true,
  workerOnline: true,
  workerBrowserReady: true,
  providers: [
    { id: "jsearch", configured: true, origin: "app", hint: "••••a1f9", updatedAt: ago(200), needsReset: false },
    { id: "adzuna", configured: false, origin: null, hint: null, updatedAt: null, needsReset: false },
    { id: "francetravail", configured: false, origin: null, hint: null, updatedAt: null, needsReset: false },
    { id: "jooble", configured: false, origin: null, hint: null, updatedAt: null, needsReset: false },
    { id: "gmail", configured: false, origin: null, hint: null, updatedAt: null, needsReset: false },
  ],
  integrationsSecret: true,
  scanConfigured: true,
  autoScan: true,
  lastScanAt: ago(88),
  scheduledScan: false,
};
