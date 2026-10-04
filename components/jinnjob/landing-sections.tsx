"use client";

import Link from "next/link";
import { AnimatePresence, motion, useInView, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, useState } from "react";
import { CATEGORIES } from "@/lib/scan/categories";
import { Lamp, Wordmark } from "./lamp";
import { Magnetic } from "./magnetic";
import { LEGAL_LINKS } from "./legal";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const reveal = (i = 0) => ({
  initial: { opacity: 0, y: 50, rotateX: 22, transformPerspective: 1200 },
  whileInView: { opacity: 1, y: 0, rotateX: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { delay: i * 0.1, duration: 1.1, ease: EASE },
});

const Check = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path className="jj-ic" d="M12 3 L19 6 V11 C19 16 15.5 19.5 12 21 C8.5 19.5 5 16 5 11 V6 Z" />
    <path className="jj-ic" d="M9 12 L11 14 L15 10" />
  </svg>
);

export function Marquees() {
  const cities = "Lyon ❦ Nantes ❦ Lille ❦ Bordeaux ❦ Toulouse ❦ Rennes ❦ Marseille ❦ Strasbourg ❦ Montpellier ❦ Paris ❦";
  const jobs = CATEGORIES.map((c) => c.label).join(" ❦ ") + " ❦";
  return (
    <section className="jj-marquees" aria-label="Métiers et villes couverts">
      <div className="jj-band is-ink" aria-hidden="true"><div className="jj-track"><span>{cities}</span><span>{cities}</span></div></div>
      <div className="jj-band is-ox">
        <div className="jj-track" aria-hidden="true"><span><em>{jobs}</em></span><span><em>{jobs}</em></span></div>
        <span className="jj-sr">Métiers couverts : {CATEGORIES.map((c) => c.label).join(", ")}.</span>
      </div>
    </section>
  );
}

/** "La machine à candidatures": an offer becomes a tailored CV, a letter and filled questions, in a 10 s loop. */
export function Machine() {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { amount: 0.3 });
  const [model, setModel] = useState("Classique");
  return (
    <section id="machine" className="jj-wrap jj-section" style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      <motion.div className="jj-head" {...reveal()}>
        <div className="jj-label" style={{ color: "#7b2d26", fontWeight: 700 }}>La machine à candidatures</div>
        <h2 className="jj-h2">Une offre te plaît ? <em>Le génie écrit ta candidature.</em></h2>
        <p className="jj-lead" style={{ maxWidth: 760 }}>
          Un CV réécrit pour l’offre, une lettre de motivation sur mesure, les questions du formulaire déjà remplies. Le tout avec ce qui est vrai dans ton profil. Toi, tu relis et tu valides.
        </p>
      </motion.div>

      <div ref={ref} className={`jj-machine${on ? " is-on" : ""}`}>
        <div>
          <div className="jj-step-label jj-label">1 · L’offre <span className="d-arrow" aria-hidden="true">→</span></div>
          <div className="jj-fiche d-pulse" style={{ padding: "20px 22px 24px", backgroundPosition: "0 54px, 0 54px" }}>
            <div className="jj-mono" style={{ fontSize: 12, letterSpacing: ".1em", color: "#5e5346", height: 34 }}>PISTE N° 0412 · ALTERNANCE</div>
            <div className="jj-fell" style={{ fontSize: 28, lineHeight: 1.1, marginTop: 10 }}>Développeur·se web</div>
            <div style={{ fontSize: 15, color: "#4a4136", marginTop: 6 }}>Atelier Plume &amp; Pixel · Lyon 3<sup>e</sup></div>
            <div style={{ fontSize: 15, lineHeight: 1.6, marginTop: 14 }}>On cherche quelqu’un à l’aise avec <strong>React</strong> et <strong>Node.js</strong>, curieux, prêt à livrer dès le premier mois.</div>
            <div style={{ fontSize: 14, color: "#4a4136", marginTop: 12 }}>Question du formulaire : <em>Disponible en janvier ?</em></div>
          </div>
        </div>

        <div>
          <div className="jj-step-label jj-label">2 · Ton CV, réécrit pour elle <span className="d-arrow" aria-hidden="true" style={{ animationDelay: ".3s" }}>→</span></div>
          <div className="jj-sheet">
            <svg className="d-quill" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true" style={{ position: "absolute", left: 120, top: 60, color: "#7b2d26", zIndex: 2 }}>
              <path className="jj-ic" d="M6 34 L30 10 C34 6 38 8 34 12 L10 36 Z" style={{ strokeWidth: 2 }} />
              <path className="jj-ic" d="M6 34 L4 38" style={{ strokeWidth: 2 }} />
            </svg>
            <div className="jj-fell" style={{ fontSize: 30, lineHeight: 1 }}>Yassine A.</div>
            <div className="d-line" style={{ fontSize: 14, color: "#4a4136", animationDelay: ".6s" }}>Développeur web · en recherche d’alternance · Lyon</div>
            <div style={{ height: 1, background: "rgba(31,26,20,.2)", margin: "4px 0" }} />
            <div className="jj-mono" style={{ fontSize: 11, letterSpacing: ".14em", color: "#7b2d26", fontWeight: 700 }}>EXPÉRIENCE</div>
            <div className="d-line" style={{ fontSize: 14, lineHeight: 1.5, animationDelay: "1s" }}>Stage — interface <span className="d-mark">React</span> pour 2 000 utilisateurs</div>
            <div className="d-line" style={{ fontSize: 14, lineHeight: 1.5, animationDelay: "1.35s" }}>API <span className="d-mark" style={{ animationDelay: ".3s" }}>Node.js</span> et base PostgreSQL en production</div>
            <div className="jj-mono" style={{ fontSize: 11, letterSpacing: ".14em", color: "#7b2d26", fontWeight: 700, marginTop: 6 }}>PROJETS</div>
            <div className="d-line" style={{ fontSize: 14, lineHeight: 1.5, animationDelay: "1.7s" }}>Application de covoiturage étudiant, livrée en équipe</div>
            <div className="d-line" style={{ fontSize: 14, lineHeight: 1.5, animationDelay: "2.05s" }}>Portfolio déployé avec Docker</div>
            <div style={{ marginTop: "auto", display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 12 }} role="group" aria-label="Modèle de CV">
              {["Classique", "Moderne", "Sobre"].map((m) => (
                <button key={m} type="button" className="jj-tab" aria-pressed={model === m} onClick={() => setModel(m)}>{m}</button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="jj-step-label jj-label">3 · Ta lettre et tes réponses</div>
          <div className="jj-sheet">
            <div className="d-line" style={{ fontSize: 14, fontWeight: 600, animationDelay: "2.6s" }}>Objet : Candidature au poste de développeur·se web</div>
            <div className="d-line jj-fell" style={{ fontSize: 18, animationDelay: "3s" }}>Madame, Monsieur,</div>
            <div className="d-line jj-fell" style={{ fontSize: 17, lineHeight: 1.45, animationDelay: "3.4s" }}>Votre atelier construit des outils que j’utiliserais moi-même.</div>
            <div className="d-line jj-fell" style={{ fontSize: 17, lineHeight: 1.45, animationDelay: "3.85s" }}>En stage, j’ai livré une interface React suivie par deux mille personnes,</div>
            <div className="d-line jj-fell" style={{ fontSize: 17, lineHeight: 1.45, animationDelay: "4.3s" }}>et je veux continuer à apprendre auprès de votre équipe…</div>
            <div className="d-q" style={{ marginTop: "auto", border: "1px solid rgba(46,91,71,.5)", background: "rgba(46,91,71,.07)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, color: "#2e5b47", fontWeight: 700 }}>Disponible en janvier ? — Oui</span>
              <span style={{ fontSize: 13, color: "#2e5b47" }}>Repris de ta réponse du 2 octobre.</span>
            </div>
            <div className="d-stamp jj-mono" style={{ position: "absolute", right: -14, bottom: -18, border: "3px solid #7b2d26", color: "#7b2d26", padding: "8px 12px", fontSize: 15, fontWeight: 700, letterSpacing: ".12em", background: "rgba(255,252,244,.9)", textAlign: "center", lineHeight: 1.3 }}>
              PRÊTE<br />À ENVOYER
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 28 }}>
        <Magnetic><Link className="jj-ribbon" href="/login">Essayer avec mon CV <span className="arr" aria-hidden="true">→</span></Link></Magnetic>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 16, color: "#4a4136" }}><Check />Rien n’est inventé, rien ne part sans ton accord.</span>
      </div>
    </section>
  );
}

const ROMAN = ["I", "II", "III"];

export function Wishes() {
  const [picked, setPicked] = useState<string[]>(["web", "devops"]);
  const [refused, setRefused] = useState(0);
  const toggle = (id: string) => {
    if (picked.includes(id)) {
      setPicked(picked.filter((x) => x !== id));
      setRefused(0);
    } else if (picked.length >= 3) setRefused((n) => n + 1);
    else {
      setPicked([...picked, id]);
      setRefused(0);
    }
  };
  const n = picked.length;
  return (
    <section className="jj-dark">
      <div className="jj-wrap jj-section" style={{ display: "flex", flexDirection: "column", gap: 32, paddingBlock: 88 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
          <div className="jj-head">
            <div className="jj-label">La règle des génies</div>
            <h2 className="jj-h2">Quels sont tes trois vœux ?</h2>
          </div>
          <div className="jj-mono" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16 }} aria-live="polite">
            <span className="jj-slots">{[0, 1, 2].map((i) => <motion.span key={i} className={`jj-slot${i < n ? " is-on" : ""}`} animate={{ scale: i < n ? [0.6, 1.2, 1] : 1 }} />)}</span>
            {n === 0 ? "Aucun vœu pour l’instant" : `${n} vœu${n > 1 ? "x" : ""} sur 3`}
          </div>
        </div>
        <div className="jj-chips">
          {CATEGORIES.map((c) => {
            const at = picked.indexOf(c.id);
            return (
              <motion.button key={c.id} type="button" className="jj-chip" aria-pressed={at >= 0} onClick={() => toggle(c.id)} whileHover={{ y: -3, rotate: -1 }} whileTap={{ scale: 0.94 }} layout>
                {at >= 0 && <span className="rank">{ROMAN[at]}</span>}
                {c.label}
              </motion.button>
            );
          })}
        </div>
        <div style={{ minHeight: 64 }} aria-live="polite">
          <AnimatePresence mode="wait">
            {refused > 0 ? (
              <motion.p key={`no${refused}`} className="jj-fell" style={{ fontSize: 26, color: "#e4b9a9" }} initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -8, 7, -5, 3, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
                <em>Trois vœux, pas un de plus.</em> C’est la règle chez les génies. Retire un vœu pour en faire un autre.
              </motion.p>
            ) : n === 3 ? (
              <motion.div key="ok" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="jj-fell" style={{ fontSize: 26 }}>Parfait. Le génie s’occupe du reste.</span>
                <Link className="jj-bound is-dark" href="/login">Recevoir mes offres <span aria-hidden="true">→</span></Link>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

const SENTENCE: { w: string; accent?: boolean }[] = [
  { w: "Le" }, { w: "stage" }, { w: "que" }, { w: "tu" }, { w: "cherches" }, { w: "est" }, { w: "déjà", accent: true }, { w: "écrit", accent: true },
  { w: "quelque" }, { w: "part." }, { w: "On" }, { w: "mène" }, { w: "l’enquête" }, { w: "pour" }, { w: "toi." },
];

function KWord({ progress, i, n, w, accent }: { progress: MotionValue<number>; i: number; n: number; w: string; accent?: boolean }) {
  const opacity = useTransform(progress, [i / n, (i + 1) / n], [0.13, 1]);
  return <motion.span style={{ opacity, color: accent ? "#7b2d26" : undefined }}>{accent ? <em>{w}</em> : w} </motion.span>;
}

/** A sentence that lights up word by word while scrolling. */
export function Kinetic() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  return (
    <section className="jj-wrap" style={{ paddingBlock: "140px 120px" }}>
      <p ref={ref} className="jj-kinetic">
        {SENTENCE.map((s, i) => <KWord key={i} progress={scrollYProgress} i={i} n={SENTENCE.length} w={s.w} accent={s.accent} />)}
      </p>
    </section>
  );
}

const CHAPTERS = [
  ["I", "Dépose ton CV.", "Le génie le lit et en tire ton profil : expériences, projets, diplômes. Il n’invente rien, tu corriges ce que tu veux."],
  ["II", "Fais tes trois vœux.", "Choisis tes métiers, ton contrat et ta ville. Pas de mots-clés à deviner : tu coches, c’est tout."],
  ["III", "Le génie enquête.", "Tôt le matin et en début d’après-midi, il lit les nouvelles offres et te montre d’abord celles qui ressemblent à ton CV."],
  ["IV", "Tu relis, tu envoies.", "Un CV et une lettre écrits pour chaque offre, avec ce qui est vrai dans ton profil. Tu relis, tu valides, tu postules."],
];

export function Chapters() {
  return (
    <section id="chapitres" className="jj-wrap" style={{ paddingBottom: 120, display: "flex", flexDirection: "column", gap: 56 }}>
      <motion.div className="jj-head" {...reveal()}>
        <div className="jj-label">Comment ça marche</div>
        <h2 className="jj-h2">Ton alternance, en quatre chapitres.</h2>
      </motion.div>
      <div className="jj-grid">
        {CHAPTERS.map(([num, title, text], i) => (
          <motion.div key={num} className={`jj-chapter${i === 3 ? " is-dark" : ""}`} {...reveal(i)}>
            <div className="num">{num}</div>
            <h3>{title}</h3>
            <p>{text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

const FEATURES: { icon: string; title: string; text: string }[] = [
  { icon: "M6 3 H14 L18 7 V21 H6 Z|M9 12 H15 M9 16 H13", title: "Il lit ton CV.", text: "Dépose ton PDF : expériences, projets, diplômes et compétences rejoignent ton profil." },
  { icon: "M12 21 C12 21 5 14 5 9 A7 7 0 0 1 19 9 C19 14 12 21 12 21 Z|M12 6.5 A2.5 2.5 0 1 1 12 11.5 A2.5 2.5 0 1 1 12 6.5 Z", title: "Il fouille toute la France.", text: "Deux fois par jour : France Travail, Adzuna et les pages carrières des entreprises." },
  { icon: "M4 6 H20 M4 12 H15 M4 18 H10", title: "Il trie par ressemblance.", text: "Les offres les plus proches de ton CV passent en premier, même sans mot en commun." },
  { icon: "M5 5 H19 M5 10 H19 M5 15 H12|M15 18 L17 20 L21 15", title: "Il résume chaque offre.", text: "« En bref » : missions, outils et rythme, en trois lignes." },
  { icon: "M6 3 H18 V21 H6 Z|M9 13 H15 M9 16 H15|M12 6 A2 2 0 1 1 12 10 A2 2 0 1 1 12 6 Z", title: "Il réécrit ton CV.", text: "Une page, lisible par les logiciels de recrutement, en trois styles : classique, moderne, sobre." },
  { icon: "M4 20 L16 8 C18 6 20 7 18 9 L6 21 Z|M14 4 L20 4", title: "Il écrit ta lettre.", text: "Une lettre pour chaque offre, avec des faits vrais de ton parcours." },
  { icon: "M5 6 L7 8 L10 5 M5 12 L7 14 L10 11 M5 18 L7 20 L10 17|M13 7 H20 M13 13 H20 M13 19 H20", title: "Il retient tes réponses.", text: "Nationalité, permis, disponibilité : tu réponds une fois, il reprend partout." },
  { icon: "M12 3 L19 6 V11 C19 16 15.5 19.5 12 21 C8.5 19.5 5 16 5 11 V6 Z|M9 9 L15 15 M15 9 L9 15", title: "Il écarte les offres fermées.", text: "Retirée ? Il s’arrête avant d’écrire. Signalée dix fois, elle disparaît pour tous." },
  { icon: "M3 7 H9 L11 9 H21 V19 H3 Z|M7 13 H17", title: "Il range tes candidatures.", text: "À relire, envoyées, entretiens : tout ton suivi au même endroit." },
];

const SOON: [string, string, string][] = [
  ["Postuler depuis n’importe quel site.", "Une extension Chrome qui remplit les formulaires pour toi.", "extension Chrome"],
  ["Les réponses des recruteurs, lues pour toi.", "Ta boîte Gmail triée : entretien, refus, relance.", "lecture de Gmail"],
  ["Des relances au bon moment.", "Une semaine sans nouvelles ? Le génie te propose un message.", "relances"],
  ["Une fiche pour l’entretien.", "L’entreprise, le poste et tes meilleurs exemples sur une page.", "fiche d’entretien"],
];

export function Features({ onSoon }: { onSoon: (feature: string) => void }) {
  return (
    <section className="jj-sand">
      <div className="jj-wrap jj-section" style={{ display: "flex", flexDirection: "column", gap: 44 }}>
        <motion.div className="jj-head" {...reveal()}>
          <div className="jj-label">Tout ce que fait le génie</div>
          <h2 className="jj-h2">Tu cherches un contrat. <em>Lui fait tout le reste.</em></h2>
        </motion.div>
        <div className="jj-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))" }}>
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} className="jj-feat" {...reveal(i % 3)}>
              <div className="jj-feat-ic">
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{f.icon.split("|").map((d) => <path key={d} className="jj-ic" d={d} />)}</svg>
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </motion.div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="jj-label">Les prochains chapitres</div>
          <div className="jj-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 16 }}>
            {SOON.map(([title, text, feature]) => (
              <button key={title} type="button" className="jj-soon" onClick={() => onSoon(feature)}>
                <span className="jj-mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "#7b2d26", fontWeight: 700 }}>BIENTÔT</span>
                <span className="jj-fell" style={{ fontSize: 22, lineHeight: 1.15 }}>{title}</span>
                <span style={{ fontSize: 15, lineHeight: 1.5, color: "#4a4136" }}>{text}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="jj-sources">
          <span className="jj-label">Les offres viennent de</span>
          <a href="https://francetravail.io" target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "#1f1a14" }}>France Travail</a>
          <a href="https://www.adzuna.fr" target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "#1f1a14" }}>Jobs by Adzuna</a>
          <span style={{ fontWeight: 600, color: "#1f1a14" }}>Pages carrières des entreprises</span>
        </div>
      </div>
    </section>
  );
}

const BEFORE = ["Quarante onglets ouverts, les mêmes annonces partout.", "La même lettre, le nom de l’entreprise à changer.", "Des candidatures pour des offres déjà fermées.", "Un tableur pour se rappeler qui a répondu."];
const AFTER = ["Un seul catalogue, trié pour toi.", "Une lettre écrite pour chaque offre.", "Les offres fermées disparaissent.", "Tout ton suivi au même endroit."];

export function Ledger() {
  return (
    <section className="jj-wrap" style={{ paddingTop: 110 }}>
      <motion.div className="jj-ledger" {...reveal()}>
        <div style={{ borderRight: "1px solid rgba(31,26,20,.2)" }}>
          <div className="jj-fellsc" style={{ fontSize: 22, letterSpacing: ".1em", color: "#5e5346" }}>Avant</div>
          {BEFORE.map((t, i) => (
            <div key={t} className="jj-ledger-row" style={{ color: "#4a4136" }}>
              <motion.span className="jj-strike" initial={{ textDecorationColor: "rgba(123,45,38,0)", opacity: 1 }} whileInView={{ textDecorationColor: "rgba(123,45,38,1)", opacity: 0.75 }} viewport={{ once: true, amount: 1 }} transition={{ delay: 0.4 + i * 0.25, duration: 0.8, ease: [0.6, 0, 0.2, 1] }}>{t}</motion.span>
            </div>
          ))}
        </div>
        <div style={{ background: "#1f1a14", color: "#f3ecdc" }}>
          <div className="jj-fellsc" style={{ fontSize: 22, letterSpacing: ".1em", color: "#e4b9a9" }}>Avec LeBonTaf</div>
          {AFTER.map((t) => <div key={t} className="jj-ledger-row">{t}</div>)}
        </div>
      </motion.div>
    </section>
  );
}

export function Recruit({ onSoon }: { onSoon: (feature: string) => void }) {
  return (
    <section id="recruteurs" className="jj-wrap" style={{ paddingTop: 96 }}>
      <motion.div className="jj-recruit" {...reveal()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
          <div className="jj-label" style={{ color: "#f0ddd0" }}>Pour les recruteurs · bientôt</div>
          <h2 className="jj-fell" style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.05 }}>Vous cherchez un·e alternant·e ?</h2>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: "#f7ede6" }}>Publiez votre offre : le génie la montre aux étudiants dont le CV lui ressemble. Vous ne recevez que des candidatures relues.</p>
        </div>
        <button type="button" className="jj-bound is-dark" onClick={() => onSoon("espace recruteur")}>Découvrir l’espace recruteur</button>
      </motion.div>
    </section>
  );
}

export function Final() {
  return (
    <section className="jj-wrap" style={{ paddingBlock: 130, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 32 }}>
      <Lamp size={96} />
      <motion.h2 className="jj-h2" style={{ fontSize: "clamp(44px, 6.5vw, 88px)", lineHeight: 1 }} {...reveal()}>
        Il était une fois <em>ton alternance.</em>
      </motion.h2>
      <p style={{ fontSize: 19, color: "#4a4136", maxWidth: 520, lineHeight: 1.55 }}>Une minute pour ouvrir ton livre. Tes premières offres t’attendent déjà.</p>
      <Magnetic><Link className="jj-ribbon" href="/login">Ouvrir mon livre <span className="arr" aria-hidden="true">→</span></Link></Magnetic>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="jj-footer">
      <div className="jj-wrap jj-footer-in">
        <Wordmark size={22} />
        <span>Offres France Travail (<a href="https://francetravail.io/produits-partages/documentation/conditions-dutilisation-api/licence-offres-emploi" target="_blank" rel="noreferrer">licence de réutilisation</a>) · <a href="https://www.adzuna.fr" target="_blank" rel="noreferrer">Jobs by Adzuna</a></span>
        <nav style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px" }} aria-label="Informations légales">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
          <Link href="/login">Se connecter</Link>
        </nav>
      </div>
    </footer>
  );
}
