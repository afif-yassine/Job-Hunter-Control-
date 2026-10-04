"use client";

import Link from "next/link";
import { MotionConfig, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Lamp, Wordmark } from "./lamp";
import { Chapters, Features, Final, Footer, Kinetic, Ledger, Machine, Marquees, Recruit, Wishes } from "./landing-sections";
import { Magnetic } from "./magnetic";
import { SoonModal } from "./soon";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Public home page for visitors who are not signed in. */
export function Landing() {
  const [soon, setSoon] = useState<string | null>(null);
  const closeSoon = useCallback(() => setSoon(null), []);
  const reduce = useReducedMotion();
  // A visitor who already saw the opening this session gets a quick one.
  const [returning] = useState(() => {
    try {
      return typeof window !== "undefined" && !!sessionStorage.getItem("jj-cover");
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("jj-cover", "1");
    } catch {
      // private mode: the opening plays every time
    }
  }, []);

  const start = reduce ? 0 : returning ? 0.5 : 2.1;

  return (
    <MotionConfig reducedMotion="user">
      <div className="jj">
        <div className="jj-grain" aria-hidden="true" />
        <ScrollProgress />
        {!reduce && <Cover quick={returning} />}
        <Nav />
        <main>
          <Hero start={start} />
          <Marquees />
          <Machine />
          <Wishes />
          <Kinetic />
          <Chapters />
          <Features onSoon={setSoon} />
          <Ledger />
          <Recruit onSoon={setSoon} />
          <Final />
        </main>
        <Footer />
        <SoonModal feature={soon} onClose={closeSoon} />
      </div>
    </MotionConfig>
  );
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  return <motion.div className="jj-progress" style={{ scaleX }} aria-hidden="true" />;
}

/** The leather cover that opens on arrival (shorter for a returning visitor). */
function Cover({ quick }: { quick: boolean }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const delay = quick ? 0.05 : 1.35;
  const duration = quick ? 0.6 : 1.2;
  return (
    <div className="jj-cover" aria-hidden="true">
      <motion.div className="jj-cover-half is-left" initial={{ rotateY: 0 }} animate={{ rotateY: -105 }} transition={{ delay, duration, ease: [0.7, 0, 0.2, 1] }} />
      <motion.div
        className="jj-cover-half is-right"
        initial={{ rotateY: 0 }}
        animate={{ rotateY: 105 }}
        transition={{ delay, duration, ease: [0.7, 0, 0.2, 1] }}
        onAnimationComplete={() => setGone(true)}
      />
      <motion.div className="jj-cover-mark" initial={{ opacity: 1, scale: 1 }} animate={{ opacity: 0, scale: 1.3 }} transition={{ delay: quick ? 0 : 1.2, duration: 0.45 }}>
        <Lamp size={120} color="#f3ecdc" cut="#7b2d26" accent="#d9b86a" />
        <span className="jj-fellsc" style={{ fontSize: 20, letterSpacing: ".3em" }}>JinnJob</span>
      </motion.div>
    </div>
  );
}

function Nav() {
  const { scrollY } = useScroll();
  const [stuck, setStuck] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setStuck(v > 24));
  return (
    <header className={`jj-nav${stuck ? " is-stuck" : ""}`}>
      <div className="jj-wrap jj-nav-in">
        <Link href="/" className="jj-brand" aria-label="JinnJob, accueil">
          <Lamp size={46} />
          <Wordmark />
        </Link>
        <nav className="jj-nav-links" aria-label="Navigation principale">
          <a className="jj-nav-a is-optional" href="#chapitres">Comment ça marche</a>
          <a className="jj-nav-a is-optional" href="#recruteurs">Recruteurs</a>
          <Link className="jj-nav-a is-login" href="/login">Se connecter</Link>
          <Link className="jj-ribbon is-small" href="/login">Faire un vœu <span className="arr" aria-hidden="true">→</span></Link>
        </nav>
      </div>
    </header>
  );
}

const LINES: { words: string[]; accent?: number }[] = [
  { words: ["Fais", "un", "vœu."] },
  { words: ["Le", "génie", "feuillette"], accent: 2 },
  { words: ["la", "France", "pour", "toi."] },
];

function Hero({ start }: { start: number }) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const lensX = useMotionValue(0);
  const lensY = useMotionValue(0);
  const [hover, setHover] = useState(false);
  const rotateY = useSpring(useTransform(px, [0, 1], [-6, 6]), { stiffness: 120, damping: 16 });
  const rotateX = useSpring(useTransform(py, [0, 1], [5, -5]), { stiffness: 120, damping: 16 });
  const { scrollY } = useScroll();
  const artY = useTransform(scrollY, [0, 700], [0, -90]);

  let n = 0;
  const word = (w: string, accent: boolean) => {
    const delay = start + 0.08 * n++;
    const inner = (
      <motion.span initial={{ y: "112%", rotate: 4 }} animate={{ y: 0, rotate: 0 }} transition={{ delay, duration: 1, ease: EASE }} style={{ transformOrigin: "left bottom" }}>
        {accent ? <em>{w}</em> : w}
      </motion.span>
    );
    if (!accent) return <span className="jj-mask">{inner}</span>;
    return (
      <span className="jj-underline">
        <span className="jj-mask">{inner}</span>
        <svg viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true">
          <motion.path
            d="M4 16 C 80 6, 160 20, 230 11 S 360 6, 396 14"
            className="jj-ic"
            style={{ stroke: "#7b2d26", strokeWidth: 3 }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: start + 0.9, duration: 1.1, ease: [0.6, 0, 0.2, 1] }}
          />
        </svg>
      </span>
    );
  };
  const fade = (d: number) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { delay: start + d, duration: 0.9, ease: EASE } });

  return (
    <section
      className="jj-wrap jj-hero"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
        lensX.set(e.clientX - r.left);
        lensY.set(e.clientY - r.top);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        px.set(0.5);
        py.set(0.5);
      }}
    >
      <div className="jj-hero-text">
        <motion.div className="jj-label" {...fade(0)}>Stage · Alternance · CDD — informatique, numérique, bureautique</motion.div>
        <h1 className="jj-h1">
          {LINES.map((line, li) => (
            <span className="line" key={li}>
              {line.words.map((w, wi) => (
                <span key={wi}>
                  {word(w, line.accent === wi)}
                  {wi < line.words.length - 1 ? " " : ""}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <motion.p className="jj-lead" {...fade(1)}>
          JinnJob fouille toute la France deux fois par jour, garde les offres qui ressemblent à ton CV, puis écrit ton CV et ta lettre de motivation pour chacune. Toi, tu relis et tu postules.
        </motion.p>
        <motion.div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 28 }} {...fade(1.15)}>
          <Magnetic>
            <Link className="jj-ribbon" href="/login">Faire mon premier vœu <span className="arr" aria-hidden="true">→</span></Link>
          </Magnetic>
          <a className="jj-quill" href="#machine">Voir le génie au travail</a>
        </motion.div>
        <motion.div className="jj-ticks" {...fade(1.3)}>
          {["CV adapté à chaque offre", "Lettre de motivation", "Suivi des candidatures"].map((t) => (
            <span key={t}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ color: "#2e5b47" }}><path className="jj-ic" d="M5 12 L10 17 L19 7" style={{ strokeWidth: 2.2 }} /></svg>
              {t}
            </span>
          ))}
        </motion.div>
      </div>

      <motion.div className="jj-hero-art" style={{ y: artY }}>
        <motion.div className="jj-scene" style={{ rotateX, rotateY }}>
          <div className="jj-book">
            <div className="jj-book-cover" />
            <div className="jj-page is-left">
              <div className="jj-fellsc" style={{ fontSize: 15, color: "#7b2d26", letterSpacing: ".06em" }}>Chapitre III</div>
              <div className="jj-fell" style={{ fontSize: 22, lineHeight: 1.1 }}>Où le génie trouva douze pistes.</div>
              <div style={{ height: 1, background: "rgba(31,26,20,.2)", margin: "6px 0" }} />
              <div className="jj-lines" style={{ height: 120 }} />
            </div>
            <div className="jj-page is-right"><div className="jj-lines" style={{ height: 190 }} /></div>
            <div className="jj-leaf" />
            <div className="jj-leaf" style={{ animationDelay: "2.5s" }} />
            <div className="jj-leaf" style={{ animationDelay: "5s" }} />
            <div className="jj-bookmark" />
          </div>
          <motion.div
            className="jj-hero-card"
            initial={{ opacity: 0, x: 40, y: 80, rotate: 8 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: -3 }}
            transition={{ delay: start + 0.5, duration: 1.2, ease: EASE }}
          >
            <motion.div className="jj-fiche" animate={{ y: [0, -10, 0] }} transition={{ delay: start + 1.8, duration: 6, repeat: Infinity, ease: "easeInOut" }}>
              <div className="jj-mono" style={{ fontSize: 12, letterSpacing: ".1em", color: "#5e5346", height: 34 }}>PISTE N° 0412</div>
              <div className="jj-fell" style={{ fontSize: 26, lineHeight: 1.1, marginTop: 8 }}>Développeur·se web</div>
              <div style={{ fontSize: 15, color: "#4a4136", marginTop: 6 }}>Atelier Plume &amp; Pixel · Lyon 3<sup>e</sup></div>
              <div style={{ fontSize: 15, lineHeight: 1.5, marginTop: 12 }}><strong>En bref</strong> — Vue.js et une API Node, dans une équipe de six. 24 mois, trois semaines en entreprise.</div>
              <motion.div
                className="jj-stamp"
                style={{ position: "absolute", right: 14, top: 14 }}
                initial={{ opacity: 0, scale: 2.6, rotate: -22 }}
                animate={{ opacity: 1, scale: 1, rotate: -9 }}
                transition={{ delay: start + 1.5, type: "spring", stiffness: 380, damping: 14 }}
              >
                TRÈS PROCHE<br />DE TON CV
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div className="jj-lens" aria-hidden="true" style={{ x: lensX, y: lensY }} animate={{ opacity: hover ? 1 : 0, scale: hover ? 1 : 0.6 }} transition={{ duration: 0.3 }} />
      <div className="jj-cue" aria-hidden="true">TOURNE LA PAGE<span /></div>
    </section>
  );
}
