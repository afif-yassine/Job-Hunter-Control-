"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BadgeCheck,
  Check,
  Cpu,
  ExternalLink,
  Flag,
  LoaderCircle,
  Lock,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Callout } from "@/components/ui";
import type { Growth } from "@/lib/admin/growth";
import { LEVELS, progress, RANKS, type LevelState, type Progress } from "@/lib/admin/levels";
import { forecast } from "@/lib/economics";
import type { Tone } from "@/lib/labels";

const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (n: number, d = 0) => `${fr(n, d)} €`;
const usd = (n: number) => (n > 0 && n < 1 ? `${fr(n, 2)} $` : `${fr(n, n < 10 ? 2 : 0)} $`);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

type Notify = (text: string, tone?: Tone) => void;

/** Growth page: where LeBonTaf stands, what it costs, and the next steps, played as levels. */
export function GrowthView({ demo, notify }: { demo?: Growth; notify: Notify }) {
  const [g, setG] = useState<Growth | null>(demo ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!demo);
  const [levelUp, setLevelUp] = useState<LevelState | null>(null);

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/growth", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setG(body as Growth);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const toggle = async (id: string, done: boolean) => {
    if (!g) return;
    const before = g.progress;
    const manual = new Map<string, string>();
    for (const l of before.levels) for (const s of l.steps) if (!s.automatic && s.done && s.id !== id) manual.set(s.id, s.doneAt ?? new Date().toISOString());
    if (done) manual.set(id, new Date().toISOString());
    const facts = { ...g.stats, analysisPriceIn: g.ai.analysisPriceIn, aiUsdMonth: g.money.aiUsdMonthProjected, monthMarginEur: g.money.marginEur };
    const after = progress(facts, manual);
    setG({ ...g, progress: after });
    const finished = after.levels.find((l, i) => l.complete && !before.levels[i].complete);
    if (finished) setLevelUp(finished);
    if (demo) return;
    try {
      const response = await fetch("/api/admin/growth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, done }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      if (id === "vercel-pro" || id === "supabase-pro") void load();
    } catch (e) {
      setG((cur) => (cur ? { ...cur, progress: before } : cur));
      notify(e instanceof Error ? e.message : "Étape non enregistrée", "bad");
    }
  };

  if (!g)
    return (
      <div className="adm-loading">
        {error ? (
          <Callout tone="bad" title="Statistiques indisponibles">
            {error}{" "}
            <button className="linkbtn" onClick={() => void load()}>
              Réessayer
            </button>
          </Callout>
        ) : (
          <p className="muted">
            <LoaderCircle className="spin" size={16} aria-hidden /> Chargement du QG…
          </p>
        )}
      </div>
    );

  return (
    <div className="grow">
      <Hero p={g.progress} at={g.at} loading={loading} reload={() => void load()} demo={Boolean(demo)} />
      <Kpis g={g} />
      <LevelsMap g={g} toggle={toggle} />
      <Money g={g} />
      <AiSection g={g} />
      <Students g={g} />
      <AnimatePresence>{levelUp && <LevelUp level={levelUp} close={() => setLevelUp(null)} />}</AnimatePresence>
    </div>
  );
}

function Hero({ p, at, loading, reload, demo }: { p: Progress; at: string; loading: boolean; reload: () => void; demo: boolean }) {
  const prevXp = RANKS.filter((r) => r.xp <= p.xp).pop()?.xp ?? 0;
  const toward = p.rank.next ? ((p.xp - prevXp) / (p.rank.next.xp - prevXp)) * 100 : 100;
  return (
    <section className="grow-hero">
      <div>
        <p className="grow-kicker">Ton QG · niveau {p.current} en cours</p>
        <h1 className="grow-title">
          Monte <em>LeBonTaf</em> niveau par niveau.
        </h1>
        <p className="muted">
          Chaque étape franchie rapporte des points. Les étapes marquées « auto » se cochent toutes seules quand les chiffres sont atteints.
        </p>
        <div className="grow-hero-actions">
          <button className="btn secondary small" onClick={reload} disabled={loading || demo}>
            <RefreshCw size={15} className={loading ? "spin" : undefined} aria-hidden /> Actualiser
          </button>
          <span className="muted small-text">
            Mis à jour {new Date(at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {demo ? " · démo" : ""}
          </span>
        </div>
      </div>
      <motion.div className="grow-rank" initial={{ rotate: -6, scale: 0.9, opacity: 0 }} animate={{ rotate: -2, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
        <span className="grow-rank-label">Rang</span>
        <strong className="grow-rank-title">{p.rank.title}</strong>
        <span className="grow-xp">
          <Zap size={15} aria-hidden /> {fr(p.xp)} XP
        </span>
        <div className="grow-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(toward)} aria-label="Points vers le rang suivant">
          <motion.span initial={{ width: 0 }} animate={{ width: `${Math.max(4, Math.min(100, toward))}%` }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }} />
        </div>
        <span className="muted small-text">{p.rank.next ? `encore ${fr(p.rank.next.xp - p.xp)} XP pour « ${p.rank.next.title} »` : "Rang maximum atteint"}</span>
      </motion.div>
    </section>
  );
}

function Kpis({ g }: { g: Growth }) {
  const s = g.stats;
  const students = Math.max(0, s.users - s.admins);
  const cost = g.money.hostingUsd + g.money.aiUsdMonthProjected;
  const tiles = [
    { icon: Users, label: "Étudiants inscrits", value: fr(students), sub: `+${fr(s.new_7d)} cette semaine · +${fr(s.new_today)} aujourd’hui` },
    { icon: Sparkles, label: "Actifs sur 7 jours", value: fr(s.active_7d), sub: `${pct(s.active_7d, s.users)} % des inscrits · ${fr(s.active_1d)} aujourd’hui` },
    { icon: BadgeCheck, label: "Abonnés Pro", value: fr(s.pro), sub: `${students ? fr((s.pro / students) * 100, 1) : "0"} % des étudiants` },
    { icon: Wallet, label: "Revenu par mois", value: eur(g.money.mrrEur, 2), sub: `${eur(g.money.netEur, 2)} après Stripe · Pro à ${eur(g.money.proPrice, 2)}` },
    { icon: Cpu, label: "Coûts du mois (prévus)", value: usd(cost), sub: `IA ${usd(g.money.aiUsdMonthProjected)} · hébergement ${usd(g.money.hostingUsd)}` },
    {
      icon: Flag,
      label: "Marge du mois",
      value: eur(g.money.marginEur, 2),
      sub: Number.isFinite(g.money.breakEvenPro) ? `rentable à partir de ${fr(g.money.breakEvenPro)} Pro` : "pas rentable à ce prix",
      tone: g.money.marginEur >= 0 ? "good" : "bad",
    },
  ];
  return (
    <section className="grow-kpis" aria-label="Chiffres clés">
      {tiles.map((t, i) => (
        <motion.div key={t.label} className={`grow-kpi card${t.tone ? ` is-${t.tone}` : ""}`} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.04 * i }}>
          <span className="grow-kpi-label">
            <t.icon size={15} aria-hidden /> {t.label}
          </span>
          <strong>{t.value}</strong>
          <span className="muted small-text">{t.sub}</span>
        </motion.div>
      ))}
    </section>
  );
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="grow-goal">
      <span className="small-text">
        {label} <b>{fr(value)}</b> / {fr(max)}
      </span>
      <div className="grow-bar thin" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        <motion.span initial={{ width: 0 }} whileInView={{ width: `${Math.max(w > 0 ? 3 : 0, w)}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} />
      </div>
    </div>
  );
}

function LevelsMap({ g, toggle }: { g: Growth; toggle: (id: string, done: boolean) => void }) {
  const [open, setOpen] = useState(g.progress.current);
  const students = Math.max(0, g.stats.users - g.stats.admins);
  const level = g.progress.levels.find((l) => l.n === open) ?? g.progress.levels[0];
  return (
    <section className="grow-section" aria-labelledby="levels-title">
      <h2 id="levels-title" className="section-title">
        <Trophy size={18} aria-hidden /> Les niveaux
      </h2>
      <div className="grow-map">
        <svg className="grow-thread" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
          <motion.path d="M2 5 C 25 0, 40 10, 50 5 S 75 0, 98 5" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.4 }} />
        </svg>
        {g.progress.levels.map((l, i) => (
          <motion.button
            key={l.id}
            type="button"
            className={`grow-level is-${l.status}${open === l.n ? " is-open" : ""}`}
            onClick={() => setOpen(l.n)}
            aria-pressed={open === l.n}
            initial={{ y: 24, opacity: 0, rotate: i % 2 ? 1.5 : -1.5 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12 * i, type: "spring", stiffness: 200, damping: 20 }}
          >
            <span className="grow-pin" aria-hidden />
            <span className="grow-level-top">
              <span className="grow-level-n">Niveau {l.n}</span>
              {l.status === "locked" && <Lock size={14} aria-label="À venir" />}
              {l.complete && <span className="grow-badge">{l.badge}</span>}
            </span>
            <strong className="grow-level-name">{l.name}</strong>
            <Bar value={Math.min(students, l.goalUsers)} max={l.goalUsers} label="Étudiants" />
            {l.goalPro > 0 && <Bar value={Math.min(g.stats.pro, l.goalPro)} max={l.goalPro} label="Pro" />}
            <span className="grow-level-foot small-text">
              <span>
                {l.done}/{l.steps.length} étapes
              </span>
              <span className="grow-xp-chip">
                {fr(l.xp)} / {fr(l.xpMax)} XP
              </span>
            </span>
          </motion.button>
        ))}
      </div>

      <div className="card grow-quests">
        <header className="grow-quests-head">
          <div>
            <p className="grow-kicker">Niveau {level.n} · badge « {level.badge} »</p>
            <h3>{level.name}</h3>
          </div>
          <span className="muted small-text">
            Hébergement à ce niveau : {usd(level.hosting.vercel + level.hosting.supabase + level.hosting.other)} / mois
          </span>
        </header>
        <ol className="grow-steps">
          {level.steps.map((s) => (
            <li key={s.id} className={s.done ? "is-done" : undefined}>
              {s.automatic ? (
                <span className={`grow-check is-auto${s.done ? " is-on" : ""}`} title="Détecté à partir des chiffres">
                  {s.done && <Check size={15} aria-hidden />}
                </span>
              ) : (
                <motion.button
                  type="button"
                  className={`grow-check${s.done ? " is-on" : ""}`}
                  onClick={() => toggle(s.id, !s.done)}
                  aria-pressed={s.done}
                  aria-label={s.done ? `Décocher : ${s.label}` : `Cocher : ${s.label}`}
                  whileTap={{ scale: 0.8 }}
                >
                  <AnimatePresence>
                    {s.done && (
                      <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
                        <Check size={15} aria-hidden />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              )}
              <div className="grow-step-main">
                <strong>{s.label}</strong>
                {s.hint && <span className="muted small-text">{s.hint}</span>}
                {s.href && (
                  <a className="linkbtn small-text" href={s.href} target="_blank" rel="noreferrer">
                    Ouvrir <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </div>
              <span className="grow-step-side">
                {s.automatic && <span className="grow-auto">auto</span>}
                <span className={`grow-xp-chip${s.done ? " is-won" : ""}`}>+{s.xp} XP</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Money({ g }: { g: Growth }) {
  const [users, setUsers] = useState(1000);
  const [rate, setRate] = useState(4);
  const env = useMemo(() => ({ PRO_PRICE_EUR: String(g.money.proPrice), EUR_USD: String(g.money.eurUsd) }), [g.money.proPrice, g.money.eurUsd]);
  const level = users <= 100 ? LEVELS[0] : users <= 1000 ? LEVELS[1] : LEVELS[2];
  const pro = Math.round((users * rate) / 100);
  const newPerDay = Math.max(Math.round(g.stats.offers_new_7d / 7), level.n * 200);
  const f = forecast({ users, pro, newOffersPerDay: newPerDay, hosting: level.hosting }, g.ai.recommended, env);
  return (
    <section className="grow-section" aria-labelledby="money-title">
      <h2 id="money-title" className="section-title">
        <Wallet size={18} aria-hidden /> Argent : combien ça coûte, combien ça rapporte
      </h2>
      <div className="grow-money">
        <div className="card grow-sim">
          <h3>Simulateur</h3>
          <label className="grow-range">
            <span>
              Étudiants inscrits <b>{fr(users)}</b>
            </span>
            <input type="range" min={10} max={10000} step={10} value={users} onChange={(e) => setUsers(Number(e.target.value))} />
          </label>
          <label className="grow-range">
            <span>
              Part qui passe Pro <b>{fr(rate, 1)} %</b> <span className="muted">({fr(pro)} Pro)</span>
            </span>
            <input type="range" min={0} max={10} step={0.5} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          </label>
          <dl className="grow-sim-out">
            <div>
              <dt>IA</dt>
              <dd>{usd(f.aiUsd)}</dd>
            </div>
            <div>
              <dt>Hébergement (niveau {level.n})</dt>
              <dd>{usd(f.hostingUsd)}</dd>
            </div>
            <div>
              <dt>Revenu Pro</dt>
              <dd>{eur(f.revenueEur)}</dd>
            </div>
            <div className={f.marginEur >= 0 ? "is-good" : "is-bad"}>
              <dt>Marge par mois</dt>
              <dd>{eur(f.marginEur)}</dd>
            </div>
          </dl>
          <p className="muted small-text">
            Rentable à partir de <b>{Number.isFinite(f.breakEvenPro) ? fr(f.breakEvenPro) : "—"} Pro</b>. En freemium, 2 à 5 % des inscrits passent payants en général.
          </p>
        </div>
        <div className="card grow-table-card">
          <h3>Coût par niveau</h3>
          <div className="grow-table-wrap">
            <table className="grow-table">
              <thead>
                <tr>
                  <th scope="col">Niveau</th>
                  <th scope="col">Hébergement</th>
                  <th scope="col">IA</th>
                  <th scope="col">Total / mois</th>
                  <th scope="col">Pro pour être rentable</th>
                </tr>
              </thead>
              <tbody>
                {g.levels.map((l) => (
                  <tr key={l.n}>
                    <th scope="row">
                      {l.n}. {l.name}
                      <span className="muted small-text">
                        {fr(l.users)} inscrits{l.pro ? `, ${fr(l.pro)} Pro` : ""}
                      </span>
                    </th>
                    <td>{usd(l.forecast.hostingUsd)}</td>
                    <td>{usd(l.forecast.aiUsd)}</td>
                    <td>
                      <b>{usd(l.forecast.totalUsd)}</b>
                    </td>
                    <td>{Number.isFinite(l.forecast.breakEvenPro) ? fr(l.forecast.breakEvenPro) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small-text">
            Un Pro rapporte {eur(g.money.proNet, 2)} après Stripe. Prix des modèles d’octobre 2026, 1 € ≈ {fr(g.money.eurUsd, 2)} $.
          </p>
        </div>
      </div>
    </section>
  );
}

function AiSection({ g }: { g: Growth }) {
  const per = g.ai.perUser;
  const rec = g.ai.perUserRecommended;
  const expensive = g.ai.analysisPriceIn > 0.2;
  const readingAndScoring = g.money.aiUsdMonthProjected * 0.6;
  const gpu = g.selfHosting.gpuUsdPerMonth;
  return (
    <section className="grow-section" aria-labelledby="ai-title">
      <h2 id="ai-title" className="section-title">
        <Cpu size={18} aria-hidden /> IA ce mois-ci
      </h2>
      {expensive && (
        <Callout tone="warn" title="Le score utilise un modèle cher">
          Le score tourne sur {g.ai.models.analysis}. Un étudiant gratuit très actif coûte jusqu’à {usd(per.freeMax)} par mois, contre {usd(rec.freeMax)} avec gemini-2.5-flash-lite. Dans
          Vercel, mets AI_MODEL_ANALYSIS = gemini-2.5-flash-lite.
        </Callout>
      )}
      <div className="grow-ai">
        <div className="card">
          <h3>Dépense réelle par modèle</h3>
          {g.ai.byModel.length === 0 ? (
            <p className="muted">Aucun appel IA enregistré ce mois-ci.</p>
          ) : (
            <div className="grow-table-wrap">
              <table className="grow-table">
                <thead>
                  <tr>
                    <th scope="col">Modèle</th>
                    <th scope="col">Appels</th>
                    <th scope="col">Jetons lus / écrits</th>
                    <th scope="col">Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {g.ai.byModel.map((m) => (
                    <tr key={m.model}>
                      <th scope="row">
                        {m.label}
                        {!m.priced && <span className="muted small-text">prix estimé</span>}
                      </th>
                      <td>{fr(m.calls)}</td>
                      <td>
                        {fr(m.input / 1000)} k / {fr(m.output / 1000)} k
                      </td>
                      <td>{usd(m.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small-text">
            {usd(g.money.aiUsdMonth)} dépensés depuis le 1er, soit environ {usd(g.money.aiUsdMonthProjected)} sur le mois.
          </p>
        </div>
        <div className="card">
          <h3>Coût d’un étudiant par mois</h3>
          <dl className="grow-per">
            <div>
              <dt>Gratuit, très actif</dt>
              <dd>{usd(per.freeMax)}</dd>
            </div>
            <div>
              <dt>Gratuit, en moyenne</dt>
              <dd>{usd(per.freeAverage)}</dd>
            </div>
            <div>
              <dt>Pro (30 dossiers, 600 scores)</dt>
              <dd>{usd(per.pro)}</dd>
            </div>
            <div>
              <dt>Lire 1 000 offres pour tous</dt>
              <dd>{fr(per.perOffer * 1000, 2)} $</dd>
            </div>
          </dl>
          <p className="muted small-text">
            Score : {g.ai.models.analysis} · CV et lettre : {g.ai.models.writing}
          </p>
        </div>
        <div className="card grow-gpu">
          <h3>Héberger nos propres modèles ?</h3>
          <p>
            Une carte graphique louée tout le mois coûte <b>{gpu.low} à {gpu.high} $</b>. La lecture des offres et les scores nous coûtent aujourd’hui environ <b>{usd(readingAndScoring)}</b> par mois.
          </p>
          <p className={readingAndScoring > gpu.high * 2 ? "grow-verdict is-go" : "grow-verdict"}>
            {readingAndScoring > gpu.high * 2 ? "Ça vaut le coup d’essayer." : "Pas encore : l’API reste bien moins chère. À revoir quand la facture IA dépasse 500 $ par mois."}
          </p>
          <p className="muted small-text">{g.selfHosting.note}</p>
        </div>
      </div>
    </section>
  );
}

function Students({ g }: { g: Growth }) {
  const s = g.stats;
  const students = Math.max(0, s.users - s.admins);
  const funnel = [
    { label: "Inscrits", value: students },
    { label: "Ont importé leur CV", value: s.with_cv },
    { label: "Dossiers créés ce mois", value: s.kits_month },
    { label: "Candidatures envoyées ce mois", value: s.applied_month },
    { label: "Entretiens ce mois", value: s.interviews_month },
  ];
  const top = Math.max(1, ...funnel.map((f) => f.value));
  return (
    <section className="grow-section" aria-labelledby="students-title">
      <h2 id="students-title" className="section-title">
        <Users size={18} aria-hidden /> Étudiants et catalogue
      </h2>
      <div className="grow-students">
        <div className="card">
          <h3>Du compte à l’entretien</h3>
          <ul className="grow-funnel">
            {funnel.map((f, i) => (
              <li key={f.label}>
                <span className="small-text">{f.label}</span>
                <span className="grow-funnel-bar">
                  <motion.span initial={{ width: 0 }} whileInView={{ width: `${Math.max(f.value ? 2 : 0, (f.value / top) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.08 * i }} />
                </span>
                <b>{fr(f.value)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Inscriptions sur 30 jours</h3>
          <Signups days={g.signups30d} at={g.at} />
        </div>
        <div className="card">
          <h3>Catalogue d’offres</h3>
          <dl className="grow-per">
            <div>
              <dt>Offres ouvertes</dt>
              <dd>{fr(s.offers_open)}</dd>
            </div>
            <div>
              <dt>Nouvelles par jour</dt>
              <dd>{fr(Math.round(s.offers_new_7d / 7))}</dd>
            </div>
          </dl>
          <Bar value={s.offers_summarized} max={s.offers_open} label="Résumées" />
          <Bar value={s.offers_embedded} max={s.offers_open} label="Vectorisées" />
          {s.offers_open > 0 && s.offers_embedded / s.offers_open < 0.9 && (
            <p className="grow-warn small-text">
              <TriangleAlert size={14} aria-hidden /> Sans vecteurs, le classement selon le CV ne marche pas : c’est le Sprint 7.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** One bar per day; hover or focus a bar for its number. */
function Signups({ days, at }: { days: { day: string; n: number }[]; at: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const series = useMemo(() => {
    const map = new Map(days.map((d) => [d.day.slice(0, 10), d.n]));
    const end = new Date(at);
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(end.getTime() - (29 - i) * 86_400_000).toISOString().slice(0, 10);
      return { day: d, n: map.get(d) ?? 0 };
    });
  }, [days, at]);
  const max = Math.max(1, ...series.map((d) => d.n));
  const total = series.reduce((t, d) => t + d.n, 0);
  const W = 300;
  const H = 96;
  const bw = W / 30;
  const label = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const h = hover !== null ? series[hover] : null;
  return (
    <div className="grow-chart">
      <p className="grow-chart-head">
        <b>{fr(total)}</b> <span className="muted small-text">inscriptions · {h ? `${label(h.day)} : ${h.n}` : "survole une barre"}</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H + 2}`} role="img" aria-label={`${total} inscriptions sur 30 jours, au plus ${max} par jour`} onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={W} y1={H + 1} y2={H + 1} className="grow-axis" />
        {series.map((d, i) => {
          const bh = d.n ? Math.max(4, (d.n / max) * (H - 6)) : 0;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${label(d.day)} : ${d.n}`}>
              <rect x={i * bw} y={0} width={bw} height={H} className="grow-hit" />
              {bh > 0 && <rect x={i * bw + 1.5} y={H + 1 - bh} width={bw - 3} height={bh} rx={2} className={hover === i ? "grow-col is-hover" : "grow-col"} />}
            </g>
          );
        })}
      </svg>
      <div className="grow-chart-axis muted small-text">
        <span>{label(series[0].day)}</span>
        <span>{label(series[29].day)}</span>
      </div>
    </div>
  );
}

function LevelUp({ level, close }: { level: LevelState; close: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(close, 5200);
    return () => window.clearTimeout(t);
  }, [close]);
  return (
    <motion.div className="grow-levelup" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div className="grow-levelup-card" initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: -2 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
        <span className="grow-kicker">Niveau {level.n} terminé</span>
        <strong>{level.name}</strong>
        <motion.span className="grow-badge big" initial={{ scale: 2.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 12 }}>
          {level.badge}
        </motion.span>
        <span className="muted small-text">+{fr(level.xpMax)} XP · le niveau suivant est débloqué</span>
      </motion.div>
    </motion.div>
  );
}
