"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  BadgeCheck,
  Check,
  Cpu,
  ExternalLink,
  Flag,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { Callout } from "@/components/ui";
import type { Growth } from "@/lib/admin/growth";
import { LEVELS, progress } from "@/lib/admin/levels";
import { forecast } from "@/lib/economics";
import type { Tone } from "@/lib/labels";
import type { CostOrigin } from "@/lib/admin/origin";
import { spendTitle, unpricedText, vectorBarLabel } from "./admin-display";
import type { GatewayCredits } from "@/lib/admin/gateway-credits";
import { GatewayCreditsView } from "./gateway-credits-view";
import { OriginTag } from "./origin-tag";

const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (n: number, d = 0) => `${fr(n, d)} €`;
const usd = (n: number) => (n > 0 && n < 1 ? `${fr(n, 2)} $` : `${fr(n, n < 10 ? 2 : 0)} $`);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

type Notify = (text: string, tone?: Tone) => void;

/** Growth page: where LeBonTaf stands, what it costs, and the next steps, played as levels. */
export function GrowthView({ demo, gatewayDemo, notify }: { demo?: Growth; gatewayDemo?: GatewayCredits; notify: Notify }) {
  const [g, setG] = useState<Growth | null>(demo ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!demo);

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
      <Header at={g.at} loading={loading} reload={() => void load()} demo={Boolean(demo)} />
      <Kpis g={g} />
      <LaunchList g={g} toggle={toggle} />
      <Money g={g} />
      <GatewayCreditsView demo={gatewayDemo} />
      <AiSection g={g} />
      <Students g={g} />
    </div>
  );
}

function Header({ at, loading, reload, demo }: { at: string; loading: boolean; reload: () => void; demo: boolean }) {
  return (
    <section className="grow-hero">
      <div>
        <p className="grow-kicker">Espace admin</p>
        <h1 className="grow-title">Où en est <em>LeBonTaf</em></h1>
        <p className="muted">Chiffres, coûts et liste de lancement. Les étapes marquées « auto » se cochent toutes seules quand les chiffres sont atteints.</p>
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
    </section>
  );
}

function Kpis({ g }: { g: Growth }) {
  const s = g.stats;
  const students = Math.max(0, s.users - s.admins);
  const cost = g.money.hostingUsd + g.money.aiUsdMonthProjected;
  const o = g.origins.money;
  // No price is adopted: the revenue figures are hypotheses and are said so, with the price as "supposé, non adopté".
  const tiles: { icon: typeof Users; label: string; value: string; sub: ReactNode; origin?: CostOrigin; tone?: "good" | "bad" }[] = [
    { icon: Users, label: "Étudiants inscrits", value: fr(students), sub: `+${fr(s.new_7d)} cette semaine · +${fr(s.new_today)} aujourd’hui` },
    { icon: Sparkles, label: "Actifs sur 7 jours", value: fr(s.active_7d), sub: `${pct(s.active_7d, s.users)} % des inscrits · ${fr(s.active_1d)} aujourd’hui` },
    { icon: BadgeCheck, label: "Comptes LeBonTaf Plus (non ouverte)", value: fr(s.pro), sub: `${students ? fr((s.pro / students) * 100, 1) : "0"} % des étudiants` },
    { icon: Wallet, label: "Revenu par mois", value: eur(g.money.mrrEur, 2), origin: o.mrrEur, sub: `${eur(g.money.netEur, 2)} après Stripe · prix supposé ${eur(g.money.proPrice, 2)}, non adopté` },
    {
      icon: Cpu,
      label: "Coûts du mois (prévus)",
      value: usd(cost),
      sub: (
        <>
          IA {usd(g.money.aiUsdMonthProjected)} <OriginTag origin={o.aiUsdMonthProjected} /> · hébergement {usd(g.money.hostingUsd)} <OriginTag origin={o.hostingUsd} />
        </>
      ),
    },
    {
      icon: Flag,
      label: "Marge du mois",
      value: eur(g.money.marginEur, 2),
      origin: o.marginEur,
      sub: Number.isFinite(g.money.breakEvenPro) ? `rentable à partir de ${fr(g.money.breakEvenPro)} abonnés payants` : "pas rentable au prix supposé",
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
          <span className="muted small-text">
            {t.origin && <OriginTag origin={t.origin} />}
            {t.sub}
          </span>
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

/** The launch list: the same steps as before, grouped by stage, without points, rank or badge. */
function LaunchList({ g, toggle }: { g: Growth; toggle: (id: string, done: boolean) => void }) {
  const students = Math.max(0, g.stats.users - g.stats.admins);
  return (
    <section className="grow-section" aria-labelledby="launch-title">
      <h2 id="launch-title" className="section-title">
        <Flag size={18} aria-hidden /> Liste de lancement
      </h2>
      {g.progress.levels.map((level) => (
        <div key={level.id} className="card grow-quests">
          <header className="grow-quests-head">
            <div>
              <p className="grow-kicker">
                Palier {level.n} · {level.done}/{level.steps.length} étapes
              </p>
              <h3>{level.name}</h3>
            </div>
            <span className="muted small-text">
              Hébergement à ce palier : {usd(level.hosting.vercel + level.hosting.supabase + level.hosting.other)} / mois <OriginTag origin={g.origins.money.hostingUsd} />
            </span>
          </header>
          <Bar value={Math.min(students, level.goalUsers)} max={level.goalUsers} label="Étudiants" />
          {level.goalPro > 0 && <Bar value={Math.min(g.stats.pro, level.goalPro)} max={level.goalPro} label="Comptes LeBonTaf Plus (objectif supposé)" />}
          <ol className="grow-steps">
            {level.steps.map((s) => (
              <li key={s.id} className={s.done ? "is-done" : undefined}>
                {s.automatic ? (
                  <span className={`grow-check is-auto${s.done ? " is-on" : ""}`} title="Détecté à partir des chiffres">
                    {s.done && <Check size={15} aria-hidden />}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`grow-check${s.done ? " is-on" : ""}`}
                    onClick={() => toggle(s.id, !s.done)}
                    aria-pressed={s.done}
                    aria-label={s.done ? `Décocher : ${s.label}` : `Cocher : ${s.label}`}
                  >
                    {s.done && <Check size={15} aria-hidden />}
                  </button>
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
                <span className="grow-step-side">{s.automatic && <span className="grow-auto">auto</span>}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
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
          <h3>Simulateur (hypothèse)</h3>
          <p className="muted small-text">Tout ce que ce simulateur calcule part de suppositions : ce n’est ni une facture ni un prix adopté.</p>
          <label className="grow-range">
            <span>
              Étudiants inscrits <b>{fr(users)}</b>
            </span>
            <input type="range" min={10} max={10000} step={10} value={users} onChange={(e) => setUsers(Number(e.target.value))} />
          </label>
          <label className="grow-range">
            <span>
              Part qui passerait à LeBonTaf Plus (hypothèse) <b>{fr(rate, 1)} %</b> <span className="muted">({fr(pro)} abonnés payants)</span>
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
              <dt>Revenu de LeBonTaf Plus (hypothèse)</dt>
              <dd>{eur(f.revenueEur)}</dd>
            </div>
            <div className={f.marginEur >= 0 ? "is-good" : "is-bad"}>
              <dt>Marge par mois</dt>
              <dd>{eur(f.marginEur)}</dd>
            </div>
          </dl>
          <p className="muted small-text">
            Rentable à partir de <b>{Number.isFinite(f.breakEvenPro) ? fr(f.breakEvenPro) : "—"} abonnés payants</b>. En freemium, 2 à 5 % des inscrits passent payants en général.
          </p>
        </div>
        <div className="card grow-table-card">
          <h3>
            Coût par niveau <OriginTag origin={g.origins.levels} />
          </h3>
          <div className="grow-table-wrap">
            <table className="grow-table">
              <thead>
                <tr>
                  <th scope="col">Niveau</th>
                  <th scope="col">Hébergement</th>
                  <th scope="col">IA</th>
                  <th scope="col">Total / mois</th>
                  <th scope="col">Abonnés payants pour être rentable</th>
                </tr>
              </thead>
              <tbody>
                {g.levels.map((l) => (
                  <tr key={l.n}>
                    <th scope="row">
                      {l.n}. {l.name}
                      <span className="muted small-text">
                        {fr(l.users)} inscrits{l.pro ? `, ${fr(l.pro)} abonnés payants` : ""}
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
            Un abonné payant rapporterait {eur(g.money.proNet, 2)} après Stripe <OriginTag origin={g.origins.money.proNet} />, pour un prix supposé de {eur(g.money.proPrice, 2)}, non adopté. Prix des modèles
            d’octobre 2026, 1 € ≈ {fr(g.money.eurUsd, 2)} $ <OriginTag origin={g.origins.money.eurUsd} />.
          </p>
        </div>
      </div>
    </section>
  );
}

function AiSection({ g }: { g: Growth }) {
  const per = g.ai.perUser;
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
          Le score tourne sur {g.ai.models.analysis}. Un étudiant gratuit très actif coûte jusqu’à {usd(per.freeMax)} par mois.
        </Callout>
      )}
      <div className="grow-ai">
        <div className="card">
          <h3>{spendTitle(g.ai.byModel.map((m) => m.origin))}</h3>
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
                      <td>
                        {usd(m.usd)} <OriginTag origin={m.origin} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {unpricedText(g.ai.unpricedCalls) && <p className="muted small-text">{unpricedText(g.ai.unpricedCalls)}</p>}
          <p className="muted small-text">
            {usd(g.money.aiUsdMonth)} <OriginTag origin={g.origins.money.aiUsdMonth} /> enregistrés depuis le 1er, soit environ {usd(g.money.aiUsdMonthProjected)}{" "}
            <OriginTag origin={g.origins.money.aiUsdMonthProjected} /> sur le mois.
          </p>
        </div>
        <div className="card">
          <h3>
            Coût d’un étudiant par mois <OriginTag origin={g.origins.perUser} />
          </h3>
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
              <dt>LeBonTaf Plus (hypothèse, non ouverte) : 30 dossiers, 600 scores</dt>
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
          <h3>
            Héberger nos propres modèles ? <OriginTag origin={g.origins.selfHosting} />
          </h3>
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
          <Bar value={s.offers_embedded} max={s.offers_open} label={vectorBarLabel(g.embeddings.counted)} />
          {g.embeddings.counted === "legacy_embedding" ? (
            <p className="muted small-text">Ce chiffre compte l’ancienne colonne de vecteurs : il ne dit pas combien d’offres ont un vecteur actuel.</p>
          ) : (
            s.offers_open > 0 &&
            s.offers_embedded / s.offers_open < 0.9 && (
              <p className="grow-warn small-text">
                <TriangleAlert size={14} aria-hidden /> Sans vecteurs, le classement selon le CV ne marche pas.
              </p>
            )
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
