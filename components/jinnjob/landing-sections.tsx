"use client";

import Link from "next/link";
import { AnimatePresence, motion, useInView, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, useState } from "react";
import { CATEGORIES } from "@/lib/scan/categories";
import { PushPin, Tape, Tent, Thread, ThreadLayer, useAnchors, type PinColor } from "./board";
import { LEGAL_LINKS } from "./legal";
import { Mark, Wordmark } from "./logo";
import { Magnetic } from "./magnetic";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const reveal = (i = 0) => ({
  initial: { opacity: 0, y: 46 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { delay: i * 0.08, duration: 0.9, ease: EASE },
});
/** A paper that flies onto the board and lands at its tilt. */
const land = (i = 0, rot = 0) => ({
  initial: { opacity: 0, y: -60, rotate: rot + (i % 2 ? 14 : -14), scale: 1.1 },
  whileInView: { opacity: 1, y: 0, rotate: rot, scale: 1 },
  viewport: { once: true, amount: 0.3 },
  transition: { delay: i * 0.12, type: "spring" as const, stiffness: 90, damping: 13 },
});

const Check = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path className="jj-ic" d="M12 3 L19 6 V11 C19 16 15.5 19.5 12 21 C8.5 19.5 5 16 5 11 V6 Z" />
    <path className="jj-ic" d="M9 12 L11 14 L15 10" />
  </svg>
);

/** Two crossed tapes scrolling the cities and the jobs we cover. */
export function Ribbons() {
  const cities = "Lyon ✦ Nantes ✦ Lille ✦ Bordeaux ✦ Toulouse ✦ Rennes ✦ Marseille ✦ Strasbourg ✦ Montpellier ✦ Paris ✦";
  const jobs = CATEGORIES.map((c) => c.label).join(" ✦ ") + " ✦";
  return (
    <section className="jj-ribbons" aria-label="Métiers et villes couverts">
      <div className="jj-band is-ink" aria-hidden="true"><div className="jj-track"><span>{jobs}</span><span>{jobs}</span></div></div>
      <div className="jj-band is-tape">
        <div className="jj-track" aria-hidden="true"><span>PISTES EN COURS ✦ {cities}</span><span>PISTES EN COURS ✦ {cities}</span></div>
        <span className="jj-sr">Métiers couverts : {CATEGORIES.map((c) => c.label).join(", ")}.</span>
      </div>
    </section>
  );
}

/** "La filature": an offer becomes a tailored CV, then a letter, joined by a thread that follows the scroll. */
export function Filature() {
  const box = useRef<HTMLDivElement>(null);
  const on = useInView(box, { amount: 0.3 });
  const { ref, pts } = useAnchors<HTMLDivElement>();
  const { scrollYProgress } = useScroll({ target: box, offset: ["start 85%", "end 55%"] });
  const first = useTransform(scrollYProgress, [0.1, 0.45], [0, 1]);
  const second = useTransform(scrollYProgress, [0.45, 0.8], [0, 1]);
  const [model, setModel] = useState("Classique");
  return (
    <section id="filature" className="jj-wrap jj-section" style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <motion.div className="jj-head" {...reveal()}>
        <div className="jj-kicker">Pièce n° 1 · La filature</div>
        <h2 className="jj-h2">Une offre te plaît ? <em>On monte ton dossier.</em></h2>
        <p className="jj-lead" style={{ maxWidth: 760 }}>
          Un CV réécrit pour l’offre et une lettre de motivation sur mesure, uniquement avec ce qui est vrai dans ton profil confirmé. Offre gratuite : 2 dossiers par mois. Toi, tu relis et tu valides.
        </p>
      </motion.div>

      <div ref={box} className="jj-board is-wide">
        <div ref={ref} className={`jj-cork jj-machine${on ? " is-on" : ""}`}>
          <ThreadLayer>
            {pts.a && pts.b && <Thread a={pts.a} b={pts.b} sag={0.08} progress={first} />}
            {pts.b && pts.c && <Thread a={pts.b} b={pts.c} sag={0.08} progress={second} />}
          </ThreadLayer>
          <div className="jj-slot-col">
            <span className="jj-anchor" data-anchor="a" />
            <PushPin color="ink" reveal="view" delay={0.4} style={{ left: "50%", top: 0 }} />
            <motion.div className="jj-step" {...land(0, -2)}>
              <div className="jj-step-label"><Tent n={1} reveal="view" delay={0.5} style={{ position: "static" }} /> L’offre</div>
              <div className="jj-fiche d-pulse">
                <div className="jj-mono jj-fiche-ref">PISTE N° 0412 · ALTERNANCE</div>
                <div className="jj-fiche-title" style={{ fontSize: 26 }}>Développeur·se web</div>
                <div className="jj-fiche-sub">Atelier Plume &amp; Pixel · Lyon 3<sup>e</sup></div>
                <div className="jj-fiche-text">On cherche quelqu’un à l’aise avec <span className="d-mark">React</span> et <span className="d-mark" style={{ animationDelay: ".3s" }}>Node.js</span>, curieux, prêt à livrer dès le premier mois.</div>
                <div className="jj-fiche-text" style={{ color: "var(--ink-2)" }}>Question du formulaire : <em>Disponible en janvier ?</em></div>
              </div>
            </motion.div>
          </div>

          <div className="jj-slot-col">
            <span className="jj-anchor" data-anchor="b" />
            <PushPin color="red" reveal="view" delay={0.55} style={{ left: "50%", top: 0 }} />
            <motion.div className="jj-step" {...land(1, 1.5)}>
              <div className="jj-step-label"><Tent n={2} reveal="view" delay={0.65} style={{ position: "static" }} /> Ton CV, réécrit pour elle</div>
              <div className="jj-sheet">
                <svg className="d-quill" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
                  <path d="M8 32 L28 12 L32 16 L12 36 L6 38 Z" fill="#d2372c" />
                  <path d="M28 12 L31 9 L35 13 L32 16 Z" fill="#1c1a17" />
                </svg>
                <div className="jj-sheet-name">Yassine A.</div>
                <div className="d-line jj-sheet-small" style={{ animationDelay: ".6s" }}>Développeur web · en recherche d’alternance · Lyon</div>
                <div className="jj-rule" />
                <div className="jj-sheet-h">EXPÉRIENCE</div>
                <div className="d-line jj-sheet-row" style={{ animationDelay: "1s" }}>Stage — interface <span className="d-mark">React</span> pour 2 000 utilisateurs</div>
                <div className="d-line jj-sheet-row" style={{ animationDelay: "1.35s" }}>API <span className="d-mark" style={{ animationDelay: ".3s" }}>Node.js</span> et base PostgreSQL en production</div>
                <div className="jj-sheet-h">PROJETS</div>
                <div className="d-line jj-sheet-row" style={{ animationDelay: "1.7s" }}>Application de covoiturage étudiant, livrée en équipe</div>
                <div className="d-line jj-sheet-row" style={{ animationDelay: "2.05s" }}>Portfolio déployé avec Docker</div>
                <div className="jj-tabs" role="group" aria-label="Modèle de CV">
                  {["Classique", "Moderne", "Sobre"].map((m) => (
                    <button key={m} type="button" className="jj-tab" aria-pressed={model === m} onClick={() => setModel(m)}>{m}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="jj-slot-col">
            <span className="jj-anchor" data-anchor="c" />
            <PushPin color="green" reveal="view" delay={0.7} style={{ left: "50%", top: 0 }} />
            <motion.div className="jj-step" {...land(2, -1)}>
              <div className="jj-step-label"><Tent n={3} reveal="view" delay={0.8} style={{ position: "static" }} /> Ta lettre et tes réponses</div>
              <div className="jj-sheet">
                <div className="d-line jj-sheet-row" style={{ fontWeight: 600, animationDelay: "2.6s" }}>Objet : Candidature au poste de développeur·se web</div>
                <div className="d-line jj-letter" style={{ animationDelay: "3s" }}>Madame, Monsieur,</div>
                <div className="d-line jj-letter" style={{ animationDelay: "3.4s" }}>Votre atelier construit des outils que j’utiliserais moi-même.</div>
                <div className="d-line jj-letter" style={{ animationDelay: "3.85s" }}>En stage, j’ai livré une interface React suivie par deux mille personnes,</div>
                <div className="d-line jj-letter" style={{ animationDelay: "4.3s" }}>et je veux continuer à apprendre auprès de votre équipe…</div>
                <div className="d-q">
                  <strong>Disponible en janvier ? — Oui</strong>
                  <span>Repris de ta réponse du 2 octobre.</span>
                </div>
                <div className="d-stamp">PRÊTE<br />À ENVOYER</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 28 }}>
        <Magnetic><Link className="jj-ribbon" href="/login">Essayer avec mon CV <span className="arr" aria-hidden="true">→</span></Link></Magnetic>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 16, color: "var(--ink-2)" }}><Check />Rien n’est inventé, rien ne part sans ton accord.</span>
      </div>
    </section>
  );
}

const STICKY: ("yellow" | "pink" | "green" | "blue")[] = ["yellow", "pink", "green", "blue"];
const PIN_OF: Record<(typeof STICKY)[number], PinColor> = { yellow: "red", pink: "ink", green: "red", blue: "yellow" };
const TILT = [-3, 2, -1.5, 3, -2.5, 1, -2, 2.5, -1, 1.5, -3, 2];

/** Choose up to three tracks: each note picked gets a pin and a thread to the student's file. */
export function Pistes() {
  const [picked, setPicked] = useState<string[]>(["web", "devops"]);
  const [refused, setRefused] = useState<{ id: string; n: number } | null>(null);
  const { ref, pts } = useAnchors<HTMLDivElement>();
  const toggle = (id: string) => {
    if (picked.includes(id)) {
      setPicked(picked.filter((x) => x !== id));
      setRefused(null);
    } else if (picked.length >= 3) setRefused((r) => ({ id, n: (r?.n ?? 0) + 1 }));
    else {
      setPicked([...picked, id]);
      setRefused(null);
    }
  };
  const n = picked.length;
  return (
    <section className="jj-dark">
      <div className="jj-wrap jj-section" style={{ display: "flex", flexDirection: "column", gap: 32, paddingBlock: "96px 56px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
          <motion.div className="jj-head" {...reveal()}>
            <div className="jj-kicker is-light">Pièce n° 2 · Tes pistes</div>
            <h2 className="jj-h2">Sur quelles pistes on enquête ?</h2>
            <p className="jj-lead" style={{ color: "#d8d2c6" }}>Coche jusqu’à trois métiers. Pas de mots-clés à deviner : chaque note épinglée est reliée à ton dossier.</p>
          </motion.div>
          <div className="jj-counter" aria-live="polite">
            <span className="jj-slots">{[0, 1, 2].map((i) => <motion.span key={i} className={`jj-slot${i < n ? " is-on" : ""}`} animate={{ scale: i < n ? [0.6, 1.25, 1] : 1 }} />)}</span>
            {n === 0 ? "Aucune piste pour l’instant" : `${n} piste${n > 1 ? "s" : ""} sur 3`}
          </div>
        </div>

        <div className="jj-board is-dark">
          <div ref={ref} className="jj-cork jj-pistes">
            <ThreadLayer>
              {pts.me && picked.map((id) => (pts[id] ? <Thread key={id} a={pts.me} b={pts[id]} sag={0.06} duration={0.6} /> : null))}
            </ThreadLayer>
            <div className="jj-me">
              <span className="jj-anchor" data-anchor="me" />
              <PushPin color="red" size={26} reveal="view" style={{ left: "50%", top: 0 }} />
              <motion.div className="jj-me-card" {...land(0, -2)}>
                <div className="jj-mono jj-fiche-ref">DOSSIER · ÉTUDIANT</div>
                <div className="jj-me-photo"><Mark size={54} /></div>
                <div className="jj-me-name">Ton dossier</div>
                <div className="jj-me-sub">Alternance · Lyon et alentours</div>
              </motion.div>
            </div>
            <div className="jj-notes">
              {CATEGORIES.map((c, i) => {
                const at = picked.indexOf(c.id);
                const tone = STICKY[i % STICKY.length];
                const shaking = refused?.id === c.id;
                return (
                  <div key={c.id} className="jj-note-slot">
                    <span className="jj-anchor" data-anchor={c.id} />
                    {at >= 0 && <PushPin key={`pin-${c.id}`} color={PIN_OF[tone]} style={{ left: "50%", top: 0 }} />}
                    <motion.div
                      className="jj-note-shake"
                      animate={{ x: shaking ? [0, -9, 8, -6, 4, (refused?.n ?? 0) % 2 ? 0.01 : 0] : 0 }}
                      transition={{ duration: 0.42 }}
                    >
                      <motion.button
                        type="button"
                        className={`jj-pnote is-${tone}`}
                        aria-pressed={at >= 0}
                        onClick={() => toggle(c.id)}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.4 }}
                        animate={{ rotate: at >= 0 ? 0 : TILT[i % TILT.length] }}
                        whileHover={{ y: -4, scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 260, damping: 18, delay: (i % 6) * 0.04 }}
                      >
                        {at >= 0 && <span className="rank">#{at + 1}</span>}
                        {c.label}
                      </motion.button>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ minHeight: 48 }} aria-live="polite">
          <AnimatePresence mode="wait">
            {refused ? (
              <motion.p key={`no${refused.n}`} className="jj-handline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                Trois pistes à la fois, pas plus : un bon détective reste concentré. Retire une note pour en épingler une autre.
              </motion.p>
            ) : n === 3 ? (
              <motion.div key="ok" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="jj-handline">Parfait. On s’occupe du reste.</span>
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
  { w: "Le" }, { w: "stage" }, { w: "que" }, { w: "tu" }, { w: "cherches" }, { w: "existe" }, { w: "déjà." },
  { w: "Il" }, { w: "manque" }, { w: "juste" }, { w: "quelqu’un" }, { w: "pour" }, { w: "relier", accent: true }, { w: "les", accent: true }, { w: "indices.", accent: true },
];

function KWord({ progress, i, n, w, accent }: { progress: MotionValue<number>; i: number; n: number; w: string; accent?: boolean }) {
  const opacity = useTransform(progress, [i / n, (i + 1) / n], [0.12, 1]);
  const y = useTransform(progress, [i / n, (i + 1) / n], [14, 0]);
  return <motion.span style={{ opacity, y, display: "inline-block", color: accent ? "var(--thread)" : undefined }}>{w}&nbsp;</motion.span>;
}

/** A sentence that lights up word by word while scrolling, then a thread underlines the clue. */
export function Kinetic() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const line = useTransform(scrollYProgress, [0.82, 1], [0, 1]);
  const lineOpacity = useTransform(scrollYProgress, [0.82, 0.84], [0, 1]);
  return (
    <section className="jj-wrap" style={{ paddingBlock: "140px 110px" }}>
      <p ref={ref} className="jj-kinetic">
        {SENTENCE.map((s, i) => <KWord key={i} progress={scrollYProgress} i={i} n={SENTENCE.length} w={s.w} accent={s.accent} />)}
      </p>
      <svg className="jj-kinetic-line" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
        <motion.path d="M 4 24 C 200 6, 380 36, 560 18 S 860 10, 996 22" style={{ pathLength: line, opacity: lineOpacity }} />
      </svg>
    </section>
  );
}

const CHAPTERS = [
  ["Dépose ton CV.", "On le lit et on en tire ton profil : expériences, projets, diplômes. Rien n’est inventé, tu corriges ce que tu veux."],
  ["Épingle tes pistes.", "Choisis tes métiers, ton contrat et ta ville. Pas de mots-clés à deviner : tu coches, c’est tout."],
  ["On mène l’enquête.", "Tôt le matin et en début d’après-midi, on lit les nouvelles offres et on te montre d’abord celles qui ressemblent à ton CV."],
  ["Tu relis, tu envoies.", "Quand une offre te plaît, on écrit ton CV et ta lettre à partir de ton profil confirmé. Offre gratuite : 2 dossiers par mois. Tu relis, tu valides, tu postules."],
];

export function Chapters() {
  const { ref, pts } = useAnchors<HTMLDivElement>();
  const keys = CHAPTERS.map((_, i) => `k${i}`);
  return (
    <section id="chapitres" className="jj-wrap" style={{ paddingBottom: 120, display: "flex", flexDirection: "column", gap: 56 }}>
      <motion.div className="jj-head" {...reveal()}>
        <div className="jj-kicker">Pièce n° 3 · La méthode</div>
        <h2 className="jj-h2">Ton stage, résolu en quatre indices.</h2>
      </motion.div>
      <div ref={ref} className="jj-grid jj-clues">
        <ThreadLayer>
          {keys.slice(1).map((k, i) => (pts[keys[i]] && pts[k] ? <Thread key={k} a={pts[keys[i]]} b={pts[k]} sag={0.1} reveal="view" delay={0.5 + i * 0.25} /> : null))}
        </ThreadLayer>
        {CHAPTERS.map(([title, text], i) => (
          <div key={title} className="jj-clue-slot">
            <span className="jj-anchor" data-anchor={keys[i]} />
            <PushPin color={i === 3 ? "red" : "ink"} reveal="view" delay={0.2 + i * 0.12} style={{ left: "50%", top: 0 }} />
            <motion.div className={`jj-clue${i === 3 ? " is-dark" : ""}`} {...land(i, [-2, 1.5, -1, 2][i])}>
              <Tent n={i + 1} reveal="view" delay={0.4 + i * 0.12} style={{ position: "static", alignSelf: "flex-start" }} />
              <h3>{title}</h3>
              <p>{text}</p>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES: { icon: string; title: string; text: string }[] = [
  { icon: "M6 3 H14 L18 7 V21 H6 Z|M9 12 H15 M9 16 H13", title: "On lit ton CV.", text: "Dépose ton PDF : expériences, projets, diplômes et compétences rejoignent ton profil." },
  { icon: "M12 21 C12 21 5 14 5 9 A7 7 0 0 1 19 9 C19 14 12 21 12 21 Z|M12 6.5 A2.5 2.5 0 1 1 12 11.5 A2.5 2.5 0 1 1 12 6.5 Z", title: "On fouille toute la France.", text: "Deux fois par jour : France Travail, Adzuna et les pages carrières des entreprises." },
  { icon: "M10 4 A6 6 0 1 1 10 16 A6 6 0 1 1 10 4 Z|M14.5 14.5 L20 20", title: "On trie par ressemblance.", text: "Les offres les plus proches de ton CV passent en premier, même sans mot en commun." },
  { icon: "M5 5 H19 M5 10 H19 M5 15 H12|M15 18 L17 20 L21 15", title: "On résume chaque offre.", text: "« En bref » : missions, outils et rythme, en trois lignes." },
  { icon: "M6 3 H18 V21 H6 Z|M9 13 H15 M9 16 H15|M12 6 A2 2 0 1 1 12 10 A2 2 0 1 1 12 6 Z", title: "On réécrit ton CV.", text: "Une page, lisible par les logiciels de recrutement, en trois styles : classique, moderne, sobre." },
  { icon: "M4 20 L16 8 C18 6 20 7 18 9 L6 21 Z|M14 4 L20 4", title: "On écrit ta lettre.", text: "Une lettre quand une offre te plaît, avec des faits vrais de ton parcours." },
  { icon: "M12 3 L19 6 V11 C19 16 15.5 19.5 12 21 C8.5 19.5 5 16 5 11 V6 Z|M9 9 L15 15 M15 9 L9 15", title: "On écarte les fausses pistes.", text: "Offre retirée ? On s’arrête avant d’écrire. Signalée dix fois, elle disparaît pour tous." },
  { icon: "M3 7 H9 L11 9 H21 V19 H3 Z|M7 13 H17", title: "On range tes candidatures.", text: "À relire, envoyées, entretiens : tout ton suivi au même endroit." },
];

export function Features() {
  return (
    <section className="jj-sand">
      <div className="jj-wrap jj-section" style={{ display: "flex", flexDirection: "column", gap: 44 }}>
        <motion.div className="jj-head" {...reveal()}>
          <div className="jj-kicker">Pièce n° 4 · Le rapport</div>
          <h2 className="jj-h2">Tu cherches un contrat. <em>On fait tout le reste.</em></h2>
        </motion.div>
        <div className="jj-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 28 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className="jj-feat-slot">
              <PushPin color={(["red", "ink", "yellow"] as const)[i % 3]} reveal="view" delay={0.25 + (i % 3) * 0.1} style={{ left: "50%", top: 0 }} />
              <motion.div className="jj-feat" {...land(i % 3, [-1.5, 1, -0.6][i % 3])}>
                <div className="jj-feat-ic">
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{f.icon.split("|").map((d) => <path key={d} className="jj-ic" d={d} />)}</svg>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </motion.div>
            </div>
          ))}
        </div>
        <div className="jj-sources">
          <span className="jj-label">Les offres viennent de</span>
          <a href="https://francetravail.io" target="_blank" rel="noreferrer">France Travail</a>
          <a href="https://www.adzuna.fr" target="_blank" rel="noreferrer">Jobs by Adzuna</a>
          <span>Pages carrières des entreprises</span>
        </div>
      </div>
    </section>
  );
}

const BEFORE = ["Quarante onglets ouverts, les mêmes annonces partout.", "La même lettre, le nom de l’entreprise à changer.", "Des candidatures pour des offres déjà fermées.", "Un tableur pour se rappeler qui a répondu."];
const AFTER = ["Un seul catalogue, trié pour toi.", "Une lettre écrite quand une offre te plaît.", "Les offres fermées disparaissent.", "Tout ton suivi au même endroit."];

export function Ledger() {
  return (
    <section className="jj-wrap" style={{ paddingTop: 110 }}>
      <div className="jj-ledger">
        <motion.div className="jj-ledger-before" {...land(0, -1.5)}>
          <Tape style={{ left: "44%", top: -12, rotate: "-4deg" }} />
          <div className="jj-ledger-h">Avant</div>
          {BEFORE.map((t, i) => (
            <div key={t} className="jj-ledger-row">
              <motion.span
                className="jj-strike"
                initial={{ backgroundSize: "0% 3px" }}
                whileInView={{ backgroundSize: "100% 3px" }}
                viewport={{ once: true, amount: 1 }}
                transition={{ delay: 0.5 + i * 0.3, duration: 0.6, ease: [0.6, 0, 0.3, 1] }}
              >
                {t}
              </motion.span>
            </div>
          ))}
        </motion.div>
        <motion.div className="jj-ledger-after" {...land(1, 1)}>
          <PushPin color="red" reveal="view" delay={0.5} style={{ left: "50%", top: 6 }} />
          <div className="jj-ledger-h">Avec LeBonTaf</div>
          {AFTER.map((t, i) => (
            <motion.div key={t} className="jj-ledger-row" initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 1.2 + i * 0.18, duration: 0.5 }}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path className="jj-ic" d="M5 12 L10 17 L19 7" style={{ strokeWidth: 2.6, color: "#7fd3a3" }} /></svg>
              {t}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}



export function Final() {
  return (
    <section className="jj-wrap jj-final">
      <motion.div initial={{ opacity: 0, scale: 0.6, rotate: -20 }} whileInView={{ opacity: 1, scale: 1, rotate: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
        <Mark size={92} />
      </motion.div>
      <motion.h2 className="jj-h2" style={{ fontSize: "clamp(44px, 6.5vw, 92px)", lineHeight: 0.98 }} {...reveal()}>
        Affaire classée : <em>tu as ton taf.</em>
      </motion.h2>
      <motion.div initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.8 }} aria-hidden="true">
        <motion.div
          className="jj-final-stamp"
          variants={{ hidden: { opacity: 0, scale: 3, rotate: -30 }, shown: { opacity: 1, scale: 1, rotate: -8 } }}
          transition={{ delay: 0.5, type: "spring", stiffness: 480, damping: 16 }}
        >
          AFFAIRE RÉSOLUE
        </motion.div>
      </motion.div>
      <p style={{ fontSize: 19, color: "var(--ink-2)", maxWidth: 520, lineHeight: 1.55 }}>Une minute pour ouvrir ton dossier. Tes premières pistes t’attendent déjà.</p>
      <Magnetic><Link className="jj-ribbon" href="/login">Ouvrir mon dossier <span className="arr" aria-hidden="true">→</span></Link></Magnetic>
    </section>
  );
}

export function Footer({ pricing = false }: { pricing?: boolean }) {
  return (
    <footer className="jj-footer">
      <div className="jj-wrap jj-footer-in">
        <Wordmark size={22} />
        <span>Offres France Travail (<a href="https://francetravail.io/produits-partages/documentation/conditions-dutilisation-api/licence-offres-emploi" target="_blank" rel="noreferrer">licence de réutilisation</a>) · <a href="https://www.adzuna.fr" target="_blank" rel="noreferrer">Jobs by Adzuna</a></span>
        <nav style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px" }} aria-label="Informations légales">
          {pricing && <Link href="/tarifs">LeBonTaf Plus</Link>}
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
          <Link href="/login">Se connecter</Link>
        </nav>
      </div>
    </footer>
  );
}
