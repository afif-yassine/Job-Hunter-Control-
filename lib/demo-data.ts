import { fitScore } from "./fit";
import type { Data } from "@/components/use-dashboard-data";
import type { SystemStatus } from "@/components/use-status";
import { AI_ADVICE, EMBEDDINGS_PLAN, ENRICHMENT_SOURCES, NOT_CONNECTED, SOURCES } from "@/lib/admin/catalog";
import type { AdminEnrichment, AdminOverview, AdminSource } from "@/lib/admin/overview";

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
    { id: "j1", stage: "ready", seen_at: ago(95), offer_id: "o1", applicants: 4, offers: { salary: "1 450 – 1 750 € / mois", summary: { missions: ["Intégrer des modèles d’IA générative dans l’agenda des soignants", "Écrire les API Python et leurs tests"], stack: ["Python", "FastAPI", "LLM", "PostgreSQL"], conditions: "Alternance 24 mois · Paris · rythme 3 sem. / 1 sem." } }, similarity: 0.82, company: "Doctolib", title: "Alternant développeur IA", contract_type: "Alternance", location: "Paris (75)", source_url: "https://www.linkedin.com/jobs/view/1", official_url: "https://www.linkedin.com/jobs/view/1", description: "…", match_score: 88, score_breakdown: breakdown, status: "WAITING_APPROVAL", publication_date: null, source_platform: "jsearch:LinkedIn", created_at: ago(90), job_sources: [
      { platform: "jsearch:LinkedIn", url: "https://www.linkedin.com/jobs/view/1" },
      { platform: "jsearch:Indeed", url: "https://fr.indeed.com/viewjob?jk=9" },
      { platform: "ats:greenhouse", url: "https://boards.greenhouse.io/doctolib/jobs/1" },
    ] },
    { id: "j2", stage: "seen", seen_at: ago(60), similarity: 0.71, company: "Airbus", title: "Stagiaire data engineer", contract_type: "Stage", location: "Toulouse", source_url: "https://www.indeed.com/viewjob?jk=2", description: "…", match_score: 84, score_breakdown: { ...breakdown, total: 84 }, status: "ANALYZED", publication_date: null, source_platform: "jsearch:Indeed", created_at: ago(95) , offers: { salary: "1 200 € / mois", summary: { missions: ["Construire les pipelines de données des lignes d’assemblage", "Fiabiliser les tableaux de bord qualité"], stack: ["Python", "Spark", "Airflow", "SQL"], conditions: "Stage 6 mois · Toulouse · 2 jours de télétravail" } } },
    { id: "j3", stage: "applied", applied_at: ago(60 * 24 * 9), seen_at: ago(60 * 24 * 10), offers: { salary: "1 600 € / mois" }, company: "Alan", title: "Développeur full-stack en alternance", contract_type: "Alternance", location: "Paris (75)", source_url: "https://www.welcometothejungle.com/fr/jobs/3", description: "…", match_score: 67, status: "ANALYZED", publication_date: null, source_platform: "jsearch:Welcome to the Jungle", created_at: ago(300) },
    { id: "j4", stage: "new", company: "Entreprise non communiquée", title: "Alternance développeur web", contract_type: "Alternance", location: "Nanterre (92)", source_url: "https://candidat.francetravail.fr/offres/recherche/detail/4", description: null, match_score: null, status: "DISCOVERED", publication_date: "2026-09-18", source_platform: "francetravail", created_at: ago(20) },
    { id: "j6", company: "Logistix Services", title: "Stage assistant administratif", contract_type: "Stage", location: "Paris", source_url: "https://jooble.org/desc/6", description: "…", match_score: null, status: "DISCOVERED", publication_date: null, source_platform: "jooble", created_at: ago(15), review_flag: "SUSPECTED", review_reason: "Mission typique des arnaques (colis, chèques, cartes prépayées) · Contact demandé par messagerie (WhatsApp/Telegram)" },
    { id: "j7", company: "Doctolib", title: "Software Engineer Backend Java — Alternance", contract_type: "Alternance", location: "Paris", source_url: "https://www.welcometothejungle.com/fr/jobs/7", description: "…", match_score: null, status: "DISCOVERED", publication_date: null, source_platform: "jsearch:Welcome to the Jungle", created_at: ago(12), review_flag: "PROBABLE_DUPLICATE", review_reason: "Peut-être la même offre qu’une autre déjà trouvée (même entreprise, intitulé très proche).", duplicate_of: "j1" },
    { id: "j8", stage: "seen", company: "Qonto", title: "Alternance Développeur Front-end", contract_type: "Alternance", location: "Paris", source_url: "https://jobs.lever.co/qonto/8", description: "…", match_score: 71, status: "ANALYZED", publication_date: null, source_platform: "ats:lever", created_at: ago(30), gone_reason: "Retirée de la page carrière de l’entreprise." },
    { id: "j9", stage: "interview", status: "INTERVIEW", interview_at: new Date(Date.now() + 2 * 86_400_000 + 3 * 3_600_000).toISOString(), applied_at: ago(60 * 24 * 6), seen_at: ago(60 * 24 * 8), company: "BlaBlaCar", title: "Alternance développeur mobile React Native", contract_type: "Alternance", location: "Paris (75)", source_url: "https://www.welcometothejungle.com/fr/jobs/9", description: "…", match_score: 91, publication_date: null, source_platform: "jsearch:Welcome to the Jungle", created_at: ago(60 * 24 * 9), offers: { salary: "1 500 € / mois" }, notes: "Entretien avec Léa (tech lead). Préparer le projet covoiturage." },
    { id: "j10", stage: "rejected", status: "REJECTED", applied_at: ago(60 * 24 * 20), seen_at: ago(60 * 24 * 21), company: "Leboncoin", title: "Stage développeur back-end Go", contract_type: "Stage", location: "Paris (75)", source_url: "https://jobs.lever.co/leboncoin/10", description: "…", match_score: 62, publication_date: null, source_platform: "ats:lever", created_at: ago(60 * 24 * 22) },
    { id: "j11", stage: "new", company: "OVHcloud", title: "Alternance administrateur systèmes Linux", contract_type: "Alternance", location: "Roubaix (59)", source_url: "https://candidat.francetravail.fr/offres/recherche/detail/11", description: "…", match_score: null, similarity: 0.76, status: "DISCOVERED", publication_date: "2026-10-04", source_platform: "francetravail", created_at: ago(200), offers: { salary: "Mensuel de 1 100 € à 1 300 €" } },
    { id: "j5", stage: "new", offers: { salary: "35 000 – 42 000 € / an" }, similarity: 0.8, company: "Capgemini", title: "Alternant ingénieur data & IA", contract_type: "Alternance", location: "Paris La Défense", source_url: "https://www.hellowork.com/fr-fr/emplois/5.html", description: "Missions : …", match_score: null, status: "DISCOVERED", publication_date: null, source_platform: "adzuna", created_at: ago(20) },
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
    { id: "d6", job_id: "j9", kind: "TAILORED_CV", filename: "CV_BlaBlaCar.pdf", version: 1, approved: true, storage_path: null, created_at: ago(60 * 24 * 7), jobs: { company: "BlaBlaCar", title: "Alternance développeur mobile React Native" } },
    { id: "d7", job_id: "j9", kind: "COVER_LETTER", filename: "Lettre_BlaBlaCar.pdf", version: 1, approved: true, storage_path: null, created_at: ago(60 * 24 * 7), jobs: { company: "BlaBlaCar", title: "Alternance développeur mobile React Native" } },
    { id: "d8", job_id: "j3", kind: "TAILORED_CV", filename: "CV_Alan.pdf", version: 1, approved: true, storage_path: null, created_at: ago(60 * 24 * 10), jobs: { company: "Alan", title: "Développeur full-stack en alternance" } },
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
  scheduledScan: true,
  isAdmin: true,
  plan: { plan: "free", used: 1, limit: 2, resetsOn: "1er novembre" },
  usage: {
    scan: { used: 1, limit: 3 },
    analysis: { used: 12, limit: 20 },
    generation: { used: 2, limit: 10 },
  },
};

const demoStates: Record<string, Partial<AdminSource>> = {
  francetravail: { state: "active", stateLabel: "Activé", keyOrigin: "platform", lastRun: { status: "ok", at: ago(40), found: 34, message: null, cached: false }, runs7d: { ok: 14, problems: 0, cached: 20 }, quality: { offers: 120, links: 160, analyzed: 60, avgScore: 71, strong: 12, suspected: 1, toReview: 4, unreadable: 0 } },
  jsearch: { state: "budget", stateLabel: "Budget gratuit atteint", keyOrigin: "platform", budget: { used: 180, limit: 180, period: "2026-09" }, lastRun: { status: "budget", at: ago(120), found: 0, message: "Budget gratuit atteint pour jsearch (180 appels ce mois-ci).", cached: false }, runs7d: { ok: 9, problems: 1, cached: 31 }, quality: { offers: 210, links: 330, analyzed: 90, avgScore: 76, strong: 22, suspected: 0, toReview: 9, unreadable: 6 } },
  adzuna: { state: "missing_key", stateLabel: "Clé manquante", keyOrigin: "none", missingKeys: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"] },
  jooble: { state: "auth", stateLabel: "Clé refusée", keyOrigin: "platform", lastRun: { status: "auth", at: ago(300), found: 0, message: "Clé Jooble refusée : vérifie la clé reçue par e-mail.", cached: false }, runs7d: { ok: 0, problems: 3, cached: 0 } },
  "ats:greenhouse": { state: "active", stateLabel: "Activé", keyOrigin: "not_needed", companies: 6, lastRun: { status: "ok", at: ago(40), found: 11, message: null, cached: false }, quality: { offers: 18, links: 18, analyzed: 18, avgScore: 81, strong: 7, suspected: 0, toReview: 0, unreadable: 0 } },
  "ats:lever": { state: "active", stateLabel: "Activé", keyOrigin: "not_needed", companies: 3, lastRun: { status: "ok", at: ago(40), found: 4, message: null, cached: true } },
  "ats:ashby": { state: "idle", stateLabel: "Activé — aucune entreprise ajoutée", keyOrigin: "not_needed", companies: 0 },
  "ats:smartrecruiters": { state: "idle", stateLabel: "Activé — aucune entreprise ajoutée", keyOrigin: "not_needed", companies: 0 },
  "ats:workable": { state: "idle", stateLabel: "Activé — aucune entreprise ajoutée", keyOrigin: "not_needed", companies: 0 },
  "ats:recruitee": { state: "idle", stateLabel: "Activé — aucune entreprise ajoutée", keyOrigin: "not_needed", companies: 0 },
  gmail: { state: "optional", stateLabel: "Facultatif — non configuré", keyOrigin: "none", missingKeys: ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"] },
  webhook: { state: "optional", stateLabel: "Facultatif — non configuré", keyOrigin: "none", missingKeys: ["SCAN_WEBHOOK_URL"] },
};

export const demoAdmin: AdminOverview = {
  ai: {
    provider: "Google Gemini",
    configured: true,
    analysisModel: "gemini-3.6-flash",
    writingModel: "gemini-3.6-flash",
    usageToday: { scan: 4, analysis: 37, generation: 6 },
    advice: AI_ADVICE,
  },
  embeddings: EMBEDDINGS_PLAN,
  sources: SOURCES.map((s, i) => ({
    ...s,
    n: i + 1,
    state: "active",
    stateLabel: "Activé",
    keyOrigin: "platform",
    missingKeys: [],
    lastRun: null,
    runs7d: { ok: 0, problems: 0, cached: 0 },
    budget: null,
    quality: null,
    companies: s.id.startsWith("ats:") ? 0 : null,
    ...demoStates[s.id],
  })),
  enrichment: ENRICHMENT_SOURCES.map(
    (e, i): AdminEnrichment => ({
      ...e,
      n: i + 1,
      ready: e.id === "ft:marche",
      missing: e.id === "ft:marche" || e.unused ? [] : [e.scopeVar, e.urlVar],
      lastRun: e.id === "ft:marche" ? { status: "ok", at: ago(40), message: null } : null,
    }),
  ),
  notConnected: NOT_CONNECTED,
  automation: { cronConfigured: true, sharedCache: true, lastServerRun: ago(25) },
  worker: { configured: true, online: true, browserReady: true },
  drive: true,
  alerts: [
    { title: "Budget gratuit atteint : jsearch", message: "Budget gratuit atteint pour jsearch (180 appels ce mois-ci).", at: ago(120), read: false },
    { title: "Clé refusée : jooble", message: "Clé Jooble refusée : vérifie la clé reçue par e-mail.", at: ago(300), read: true },
  ],
  actions: [
    { level: "required", text: "Jooble : clé refusée. Remplace-la dans Vercel (ou Réglages)." },
    { level: "recommended", text: "JSearch (Google Jobs) : budget gratuit atteint pour la période. Rien à faire si c’est voulu ; sinon augmente la limite ou passe au plan payant." },
    { level: "recommended", text: "Ajoute des pages carrière d’entreprises dans Réglages > Recherche (gratuit, sans clé)." },
    { level: "before_launch", text: "Active la protection des mots de passe compromis dans Supabase (Authentication > Security)." },
    { level: "before_launch", text: "France Travail : Licence ouverte : usage commercial autorisé en citant France Travail." },
  ],
};

/** Admin growth page fixture (/admin?demo=1 with DEMO_MODE=1). */
export const demoGrowthRaw = {
  users: 64,
  admins: 1,
  new_today: 3,
  new_7d: 19,
  new_30d: 52,
  active_1d: 11,
  active_7d: 31,
  active_30d: 47,
  pro: 0,
  with_cv: 38,
  kits_month: 41,
  applied_month: 27,
  interviews_month: 4,
  offers_open: 3756,
  offers_summarized: 3410,
  offers_embedded: 3398,
  offers_new_7d: 1240,
  ai_by_model: [
    { model: "gemini-3.6-flash", calls: 96, input: 290_000, output: 470_000 },
    { model: "gemini-2.5-flash-lite", calls: 4100, input: 6_200_000, output: 1_500_000 },
    { model: "gemini-embedding-001", calls: 3398, input: 1_020_000, output: 0 },
  ],
  signups_30d: Array.from({ length: 30 }, (_, i) => ({
    day: new Date(Date.UTC(2026, 8, 21 + i)).toISOString().slice(0, 10),
    n: [0, 1, 0, 2, 1, 0, 0, 3, 1, 2, 0, 1, 4, 2, 1, 0, 2, 3, 1, 5, 2, 1, 3, 2, 4, 6, 3, 2, 5, 3][i],
  })),
};

export const demoQuests = [
  { id: "deploy-sprint6", done: true, done_at: "2026-10-06T18:00:00Z" },
  { id: "gemini-paid", done: true, done_at: "2026-10-06T19:00:00Z" },
];

// The free comparison for demo offers that the AI did not analyse.
for (const job of demoData.jobs)
  if (job.match_score === null && typeof job.similarity === "number")
    job.fit = fitScore(job.similarity, ["linux", "bash", "docker"], ["ansible", "kubernetes"]);
