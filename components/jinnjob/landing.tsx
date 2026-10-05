"use client";

import Link from "next/link";
import {
  MotionConfig,
  motion,
  useAnimationControls,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PushPin, Tape, Tent, Thread, type PinColor, type Pt } from "./board";
import { Chapters, Features, Filature, Final, Footer, Kinetic, Ledger, Pistes, Recruit, Ribbons } from "./landing-sections";
import { Logo } from "./logo";
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

  const start = reduce ? 0 : returning ? 0.95 : 2.55;

  return (
    <MotionConfig reducedMotion="user">
      <div className="jj">
        <ScrollProgress />
        {!reduce && <Door quick={returning} />}
        <Nav />
        <main>
          <Hero start={start} />
          <Ribbons />
          <Filature />
          <Pistes />
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

/** A door that opens on arrival, light pours out, and we walk through it (shorter for a returning visitor; a click skips it). */
function Door({ quick }: { quick: boolean }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const open = quick ? 0.1 : 0.75;
  const zoomAt = quick ? 0.5 : 1.95;
  return (
    <motion.div
      className="lbt-door-scene"
      aria-hidden="true"
      onClick={() => setGone(true)}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: zoomAt + (quick ? 0.35 : 0.55), duration: 0.4 }}
      onAnimationComplete={() => setGone(true)}
    >
      <motion.div className="lbt-door-zoom" initial={{ scale: 1 }} animate={{ scale: quick ? 7 : 10 }} transition={{ delay: zoomAt, duration: quick ? 0.6 : 0.95, ease: [0.7, 0, 0.25, 1] }}>
        {!quick && (
          <motion.div className="lbt-door-top" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.55, ease: EASE }}>
            <Logo size={46} dark />
          </motion.div>
        )}
        <motion.div className="lbt-door-glow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: open + 0.2, duration: 0.9 }} />
        <div className="lbt-door-frame">
          <motion.div className="lbt-door-light" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: open + 0.12, duration: 0.8, ease: EASE }} />
          <motion.div
            className="lbt-door-leaf"
            initial={{ rotateY: 0 }}
            animate={{ rotateY: -112 }}
            transition={{ delay: open, duration: quick ? 0.5 : 0.95, ease: [0.55, 0, 0.2, 1] }}
          >
            <span className="lbt-door-panel" />
            <span className="lbt-door-panel is-low" />
            <motion.span className="lbt-door-knob" initial={{ rotate: 0 }} animate={{ rotate: [0, -50, 0] }} transition={{ delay: Math.max(0, open - 0.35), duration: 0.35 }} />
          </motion.div>
          <motion.div className="lbt-door-floor" initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ delay: open + 0.2, duration: 0.7, ease: EASE }} />
        </div>
        {!quick && (
          <div className="lbt-door-tag">
            {["Ton alternance.", "Ton stage.", "Ton bon départ."].map((t, i) => (
              <motion.span key={t} className={i === 2 ? "is-last" : undefined} initial={{ opacity: 0, y: 18, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.95 + i * 0.24, duration: 0.55, ease: EASE }}>
                {t}
              </motion.span>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Nav() {
  const { scrollY } = useScroll();
  const [stuck, setStuck] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setStuck(v > 24));
  return (
    <header className={`jj-nav${stuck ? " is-stuck" : ""}`}>
      <div className="jj-wrap jj-nav-in">
        <Link href="/" className="jj-brand" aria-label="LeBonTaf, accueil">
          <Logo size={38} />
        </Link>
        <nav className="jj-nav-links" aria-label="Navigation principale">
          <a className="jj-nav-a is-optional" href="#chapitres">Comment ça marche</a>
          <a className="jj-nav-a is-optional" href="#recruteurs">Recruteurs</a>
          <Link className="jj-nav-a is-login" href="/login">Se connecter</Link>
          <Link className="jj-ribbon is-small" href="/login"><span className="jj-sm-hide">Ouvrir mon dossier</span><span className="jj-sm-only">Mon dossier</span> <span className="arr" aria-hidden="true">→</span></Link>
        </nav>
      </div>
    </header>
  );
}

const LINES: { words: string[]; accent?: number }[] = [
  { words: ["Ton", "alternance."] },
  { words: ["Ton", "stage."] },
  { words: ["Ton", "bon\u00a0départ."], accent: 1 },
];

function Hero({ start }: { start: number }) {
  let n = 0;
  const word = (w: string, accent: boolean) => {
    const delay = start + 0.07 * n++;
    const inner = (
      <motion.span initial={{ y: "110%", rotate: 3 }} animate={{ y: 0, rotate: 0 }} transition={{ delay, duration: 0.9, ease: EASE }} style={{ transformOrigin: "left bottom" }}>
        {accent ? <em>{w}</em> : w}
      </motion.span>
    );
    if (!accent) return <span className="jj-mask">{inner}</span>;
    return (
      <span className="jj-circled">
        <span className="jj-mask">{inner}</span>
        <svg viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <motion.path
            d="M 30 70 C 20 20, 180 6, 300 14 C 400 22, 398 92, 300 104 C 200 116, 40 112, 18 74 C 8 54, 60 30, 120 24"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: start + 0.75, duration: 0.95, ease: [0.6, 0, 0.3, 1] }}
          />
        </svg>
      </span>
    );
  };
  const fade = (d: number) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { delay: start + d, duration: 0.85, ease: EASE } });

  return (
    <section className="jj-wrap jj-hero">
      <div className="jj-hero-text">
        <motion.div className="jj-label" {...fade(0)}>
          <span className="jj-dot" /> Stage · Alternance · CDD — numérique et bureautique
        </motion.div>
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
        <motion.p className="jj-lead" {...fade(0.9)}>
          On mène l’enquête pour toi : LeBonTaf fouille toute la France deux fois par jour, relie chaque offre à ton CV, puis écrit ton CV et ta lettre de motivation pour celles qui te ressemblent. Toi, tu relis et tu postules.
        </motion.p>
        <motion.div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 28 }} {...fade(1.05)}>
          <Magnetic>
            <Link className="jj-ribbon" href="/login">Ouvrir mon dossier <span className="arr" aria-hidden="true">→</span></Link>
          </Magnetic>
          <a className="jj-quill" href="#filature">Voir l’enquête en action</a>
        </motion.div>
        <motion.ul className="jj-ticks" {...fade(1.2)}>
          {["CV adapté à chaque offre", "Lettre de motivation", "Suivi des candidatures"].map((t) => (
            <li key={t}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path className="jj-ic" d="M5 12 L10 17 L19 7" style={{ strokeWidth: 2.4, color: "#2c8a5a" }} /></svg>
              {t}
            </li>
          ))}
        </motion.ul>
      </div>
      <Board start={start} />
    </section>
  );
}

/* ---------------------------------------------------------------------------
   The board: a fixed 760 × 600 scene, scaled to the width it is given.
   Every pin sits at the top centre of its piece, so threads stay attached
   while pieces swing around their pin.
--------------------------------------------------------------------------- */

const W = 760;
const H = 600;

type PieceId = "cv" | "offer" | "map" | "offer2" | "note" | "note2";
const PIN: Record<PieceId, Pt> = {
  cv: { x: 152, y: 40 },
  offer: { x: 472, y: 34 },
  note: { x: 128, y: 362 },
  map: { x: 420, y: 300 },
  offer2: { x: 662, y: 268 },
  note2: { x: 668, y: 452 },
};
const LINKS: [PieceId, PieceId, number][] = [
  ["cv", "offer", 0.1],
  ["cv", "map", 0.08],
  ["offer", "offer2", 0.14],
  ["map", "offer2", 0.1],
  ["note", "cv", 0.04],
  ["offer2", "note2", 0.06],
];

function Board({ start }: { start: number }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  const [hot, setHot] = useState<PieceId | null>(null);
  const shake = useAnimationControls();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const lensX = useMotionValue(-200);
  const lensY = useMotionValue(-200);
  const [lens, setLens] = useState(false);
  const rotateY = useSpring(useTransform(px, [0, 1], [-5, 5]), { stiffness: 110, damping: 16 });
  const rotateX = useSpring(useTransform(py, [0, 1], [4, -4]), { stiffness: 110, damping: 16 });
  const { scrollY } = useScroll();
  const lift = useTransform(scrollY, [0, 700], [0, -70]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const t = (d: number) => start + d;
  const pieceProps = (id: PieceId) => ({ id, hot: hot === id, onHot: setHot });
  const isHot = (a: PieceId, b: PieceId) => hot === a || hot === b;

  return (
    <motion.div className="jj-hero-art" style={{ y: lift }}>
      <motion.div
        className="jj-board"
        animate={shake}
        initial={{ opacity: 0, y: 40, rotate: 1.5 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true }}
        transition={{ delay: t(-0.25), duration: 0.9, ease: EASE }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width);
          py.set((e.clientY - r.top) / r.height);
          lensX.set(e.clientX - r.left);
          lensY.set(e.clientY - r.top);
        }}
        onMouseEnter={() => setLens(true)}
        onMouseLeave={() => {
          setLens(false);
          px.set(0.5);
          py.set(0.5);
        }}
        aria-hidden="true"
      >
        <div ref={frame} className="jj-cork" style={{ height: H * scale }}>
          <div className="jj-stage-scale" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          <motion.div className="jj-stage" style={{ rotateX, rotateY }}>
            <Piece {...pieceProps("cv")} pin={PIN.cv} w={220} rot={-5} delay={t(0)} from={{ x: -260, y: 60, r: -20 }} pinColor="red">
              <Polaroid start={t(1.6)} />
            </Piece>
            <Piece {...pieceProps("offer")} pin={PIN.offer} w={270} rot={3} delay={t(0.12)} from={{ x: 120, y: -260, r: 18 }} pinColor="ink">
              <div className="jj-fiche has-stamp">
                <div className="jj-mono jj-fiche-ref">PISTE N° 0412 · ALTERNANCE</div>
                <div className="jj-fiche-title">Développeur·se web</div>
                <div className="jj-fiche-sub">Atelier Plume &amp; Pixel · Lyon 3<sup>e</sup></div>
                <div className="jj-fiche-text"><strong>En bref</strong> — Vue.js et une API Node. 24 mois, trois semaines en entreprise.</div>
                <motion.div
                  className="jj-stamp"
                  style={{ position: "absolute", right: 14, bottom: 12 }}
                  initial={{ opacity: 0, scale: 2.8, rotate: -24 }}
                  animate={{ opacity: 1, scale: 1, rotate: -9 }}
                  transition={{ delay: t(2.55), type: "spring", stiffness: 480, damping: 15 }}
                  onAnimationComplete={() => shake.start({ x: [0, -5, 4, -2, 0], y: [0, 2, -1, 0], transition: { duration: 0.32 } })}
                >
                  TRÈS PROCHE
                  <br />
                  DE TON CV
                </motion.div>
              </div>
            </Piece>
            <Piece {...pieceProps("note")} pin={PIN.note} w={150} rot={-7} delay={t(0.42)} from={{ x: -200, y: 200, r: -30 }} pinColor="green">
              <div className="jj-sticky is-yellow">
                <span>React ✓</span>
                <span>Node.js ✓</span>
                <span className="is-red">Docker ?</span>
              </div>
            </Piece>
            <Piece {...pieceProps("map")} pin={PIN.map} w={270} rot={-2} delay={t(0.26)} from={{ x: 0, y: 320, r: 10 }} pinColor="yellow">
              <MapCard start={t(2)} />
            </Piece>
            <Piece {...pieceProps("offer2")} pin={PIN.offer2} w={170} rot={7} delay={t(0.36)} from={{ x: 260, y: 40, r: 30 }} pinColor="blue">
              <div className="jj-fiche is-small">
                <div className="jj-mono jj-fiche-ref">PISTE N° 0977 · STAGE</div>
                <div className="jj-fiche-title">Data analyst</div>
                <div className="jj-fiche-sub">Nantes · 6 mois</div>
                <motion.div className="jj-score" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: t(2.2), type: "spring", stiffness: 400, damping: 14 }}>
                  71 %
                  <svg viewBox="0 0 100 60" aria-hidden="true">
                    <motion.path d="M 50 4 C 90 2, 98 40, 60 54 C 20 64, 0 30, 22 12 C 30 6, 44 4, 56 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: t(2.3), duration: 0.7 }} />
                  </svg>
                </motion.div>
              </div>
            </Piece>
            <Piece {...pieceProps("note2")} pin={PIN.note2} w={140} rot={4} delay={t(0.52)} from={{ x: 200, y: 200, r: 26 }} pinColor="red">
              <div className="jj-sticky is-pink">
                <span>Dispo en janvier ?</span>
                <span className="is-big">OUI !</span>
              </div>
            </Piece>

            <motion.div className="jj-label-strip" initial={{ opacity: 0, y: 30, rotate: -6 }} animate={{ opacity: 1, y: 0, rotate: -2 }} transition={{ delay: t(0.6), duration: 0.8, ease: EASE }}>
              <Tape style={{ left: -12, top: -6, rotate: "-30deg" }} />
              <Tape style={{ right: -12, top: -6, rotate: "28deg" }} />
              DOSSIER N° 2026 — TON STAGE
            </motion.div>
            <Tent n={1} delay={t(1.9)} style={{ left: 40, top: 520 }} />
            <Tent n={2} delay={t(2.05)} style={{ left: 528, top: 520 }} />
            <Tent n={3} delay={t(2.2)} style={{ left: 252, top: 300 }} />

            <svg className="jj-thread-layer" viewBox={`0 0 ${W} ${H}`}>
              {LINKS.map(([a, b, sag], i) => (
                <Thread key={`${a}-${b}`} a={PIN[a]} b={PIN[b]} sag={sag} delay={t(1.15 + i * 0.16)} duration={0.75} hot={isHot(a, b)} />
              ))}
            </svg>
            {(Object.keys(PIN) as PieceId[]).map((id, i) => (
              <PushPin key={id} color={PIN_COLOR[id]} size={24} delay={t(0.55 + i * 0.09)} style={{ left: PIN[id].x, top: PIN[id].y }} />
            ))}
          </motion.div>
          </div>
        </div>
        <motion.div className="jj-lens" style={{ x: lensX, y: lensY }} animate={{ opacity: lens ? 1 : 0, scale: lens ? 1 : 0.6 }} transition={{ duration: 0.25 }} />
      </motion.div>
      <p className="jj-board-caption">Survole le tableau : chaque fil relie ton CV à une piste.</p>
    </motion.div>
  );
}

const PIN_COLOR: Record<PieceId, PinColor> = { cv: "red", offer: "ink", note: "green", map: "yellow", offer2: "blue", note2: "red" };

function Piece({
  id,
  pin,
  w,
  rot,
  delay,
  from,
  hot,
  onHot,
  children,
}: {
  id: PieceId;
  pin: Pt;
  w: number;
  rot: number;
  delay: number;
  from: { x: number; y: number; r: number };
  pinColor: PinColor;
  hot: boolean;
  onHot: (id: PieceId | null) => void;
  children: ReactNode;
}) {
  return (
    <div className={`jj-piece${hot ? " is-hot" : ""}`} style={{ left: pin.x - w / 2, top: pin.y - 10, width: w }}>
      <motion.div
        style={{ transformOrigin: "50% 10px" }}
        initial={{ opacity: 0, x: from.x, y: from.y, rotate: rot + from.r, scale: 1.12 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: rot, scale: 1 }}
        transition={{ delay, type: "spring", stiffness: 70, damping: 13, mass: 1 }}
        whileHover={{ scale: 1.05, rotate: rot * 0.25, transition: { type: "spring", stiffness: 320, damping: 18 } }}
        onHoverStart={() => onHot(id)}
        onHoverEnd={() => onHot(null)}
      >
        <motion.div
          style={{ transformOrigin: "50% 10px" }}
          animate={{ rotate: [0, 0.9, 0, -0.9, 0] }}
          transition={{ delay: delay + 1.4, duration: 5 + (w % 3), repeat: Infinity, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

/** Instant photo of the student: a line drawing, scanned by a light bar. */
function Polaroid({ start }: { start: number }) {
  return (
    <div className="jj-polaroid">
      <div className="jj-polaroid-photo">
        <svg viewBox="0 0 180 150" width="100%" height="100%" aria-hidden="true">
          <circle cx="90" cy="58" r="26" />
          <path d="M 34 150 C 38 108, 62 92, 90 92 C 118 92, 142 108, 146 150" />
          <path d="M 70 52 Q 90 44 110 52" style={{ opacity: 0.5 }} />
        </svg>
        <motion.div className="jj-scan" initial={{ top: "0%", opacity: 0 }} animate={{ top: ["0%", "100%", "0%"], opacity: [0, 1, 1, 0] }} transition={{ delay: start, duration: 2.6, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }} />
      </div>
      <div className="jj-polaroid-caption">Toi · dév web · Lyon</div>
    </div>
  );
}

/** A little street map with a pin that bounces and pings. */
function MapCard({ start }: { start: number }) {
  return (
    <div className="jj-map">
      <svg viewBox="0 0 250 170" width="100%" aria-hidden="true">
        <rect width="250" height="170" className="mp-bg" />
        <path className="mp-river" d="M -10 128 C 40 110, 70 150, 120 132 S 200 96, 260 112" />
        {[
          [14, 14, 54, 36], [80, 10, 40, 30], [134, 14, 62, 24], [206, 8, 40, 38], [20, 62, 44, 34], [76, 56, 58, 40],
          [150, 50, 40, 32], [200, 60, 46, 28], [26, 104, 36, 18], [170, 96, 30, 20],
        ].map(([x, y, w, h]) => <rect key={`${x}-${y}`} className="mp-block" x={x} y={y} width={w} height={h} rx="2" />)}
        <path className="mp-road" d="M 0 52 H 250 M 70 0 V 170 M 140 0 V 120 M 0 98 C 80 96, 160 88, 250 92" />
        <motion.path
          className="mp-route"
          d="M 40 140 C 60 110, 70 70, 140 72 S 168 50, 176 40"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: start + 0.3, duration: 1.4, ease: "easeInOut" }}
        />
        <circle className="mp-ping" cx="176" cy="40" r="6" />
        <circle className="mp-ping is-late" cx="176" cy="40" r="6" />
      </svg>
      <motion.svg
        className="jj-map-pin"
        viewBox="0 0 24 32"
        width="26"
        height="34"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: [0, -8, 0], opacity: 1 }}
        transition={{ y: { delay: start + 1.6, duration: 1.2, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }, opacity: { delay: start + 1.2, duration: 0.3 } }}
        aria-hidden="true"
      >
        <path d="M12 31 C 12 31, 2 18, 2 11 A 10 10 0 0 1 22 11 C 22 18, 12 31, 12 31 Z" fill="#d2372c" />
        <circle cx="12" cy="11" r="4" fill="#fff" />
      </motion.svg>
      <div className="jj-map-caption">Lyon 3<sup>e</sup> · 14 min</div>
    </div>
  );
}
