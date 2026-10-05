"use client";

import { MotionConfig, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PushPin, Tape, Thread, type Pt } from "./board";
import { Mark, Wordmark } from "./logo";

const W = 440;
const H = 580;
const A: Pt = { x: 130, y: 46 };
const B: Pt = { x: 345, y: 74 };
const C: Pt = { x: 122, y: 368 };
const D: Pt = { x: 335, y: 338 };

/** The login side panel: a small investigation board that assembles itself. */
export function LoginBoard() {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const card = (d: number, rot: number, from: number) => ({
    initial: { opacity: 0, y: -80, rotate: rot + from },
    animate: { opacity: 1, y: 0, rotate: rot },
    transition: { delay: d, type: "spring" as const, stiffness: 80, damping: 12 },
  });
  return (
    <MotionConfig reducedMotion="user">
      <div className="jj-board jj-login-board">
        <div ref={box} className="jj-cork" style={{ height: H * scale }}>
          <div className="jj-stage-scale" style={{ width: W, height: H, transform: `scale(${scale})` }}>
            <motion.div className="jj-lb-card" style={{ left: A.x - 100, top: A.y - 10, width: 200 }} {...card(0.1, -4, -16)}>
              <div className="jj-mono jj-fiche-ref">DOSSIER · ÉTUDIANT</div>
              <div className="jj-lb-mark"><Mark size={70} /></div>
              <Wordmark size={34} />
            </motion.div>
            <motion.div className="jj-sticky is-yellow jj-lb-note" style={{ left: B.x - 70, top: B.y - 10, width: 140 }} {...card(0.3, 6, 20)}>
              <span>Ton CV</span>
              <span>Tes pistes</span>
              <span className="is-red">Tes offres</span>
            </motion.div>
            <motion.div className="jj-fiche jj-lb-fiche" style={{ left: C.x - 100, top: C.y - 10, width: 200 }} {...card(0.45, -3, -20)}>
              <div className="jj-mono jj-fiche-ref">PISTE N° 0412</div>
              <div className="jj-fiche-title" style={{ fontSize: 20 }}>Développeur·se web</div>
              <div className="jj-fiche-sub">Lyon 3<sup>e</sup> · alternance</div>
            </motion.div>
            <motion.div className="jj-sticky is-pink jj-lb-note" style={{ left: D.x - 70, top: D.y - 10, width: 140 }} {...card(0.6, 4, 18)}>
              <span>Connexion</span>
              <span className="is-red">sans mot</span>
              <span className="is-red">de passe</span>
            </motion.div>
            <motion.div className="jj-label-strip" style={{ left: 110, top: 520 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, rotate: -2 }} transition={{ delay: 0.9 }}>
              <Tape style={{ left: -12, top: -6, rotate: "-30deg" }} />
              <Tape style={{ right: -12, top: -6, rotate: "28deg" }} />
              TOME I · TON STAGE
            </motion.div>
            <svg className="jj-thread-layer is-behind" viewBox={`0 0 ${W} ${H}`}>
              <Thread a={A} b={B} sag={0.1} delay={1} />
              <Thread a={A} b={C} sag={0.06} delay={1.2} />
              <Thread a={B} b={D} sag={0.08} delay={1.4} />
              <Thread a={C} b={D} sag={0.12} delay={1.6} />
            </svg>
            {[A, B, C, D].map((p, i) => (
              <PushPin key={i} color={(["red", "ink", "yellow", "green"] as const)[i]} size={24} delay={0.55 + i * 0.12} style={{ left: p.x, top: p.y }} />
            ))}
            <motion.div
              className="jj-stamp jj-lb-stamp"
              initial={{ opacity: 0, scale: 2.8, rotate: -25 }}
              animate={{ opacity: 1, scale: 1, rotate: -12 }}
              transition={{ delay: 2.1, type: "spring", stiffness: 480, damping: 15 }}
            >
              DOSSIER
              <br />
              OUVERT
            </motion.div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
