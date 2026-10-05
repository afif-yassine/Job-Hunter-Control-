"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Pieces of the investigation board shared by the home page and the login page. */

export type Pt = { x: number; y: number };

const PIN_COLORS = { red: "#d2372c", ink: "#1c1a17", yellow: "#f2c230", green: "#2c8a5a", blue: "#2f6fd0" } as const;
export type PinColor = keyof typeof PIN_COLORS;

type Reveal = "mount" | "view";

/** A push-pin that drops onto the board. Positioned by its centre. */
export function PushPin({
  color = "red",
  size = 22,
  delay = 0,
  reveal = "mount",
  style,
  className,
}: {
  color?: PinColor;
  size?: number;
  delay?: number;
  reveal?: Reveal;
  style?: CSSProperties;
  className?: string;
}) {
  // The outer span stays in place so the in-view check sees it; the head drops inside it.
  const trigger = reveal === "view" ? { initial: "hidden", whileInView: "shown", viewport: { once: true, amount: 0.2 } } : { initial: "hidden", animate: "shown" };
  return (
    <motion.span className={`jj-pin ${className ?? ""}`} style={{ width: size, height: size, ...style }} {...trigger} aria-hidden="true">
      <motion.svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        variants={{ hidden: { y: -46, scale: 1.9, opacity: 0 }, shown: { y: 0, scale: 1, opacity: 1 } }}
        transition={{ delay, type: "spring", stiffness: 560, damping: 20 }}
      >
        <ellipse cx="15" cy="17" rx="7.5" ry="3.2" fill="rgba(0,0,0,.28)" />
        <circle cx="12" cy="11" r="8.4" fill={PIN_COLORS[color]} />
        <path d="M5 13.5 A 8.4 8.4 0 0 0 19 14" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="2.6" />
        <circle cx="9.2" cy="8" r="2.6" fill="#fff" opacity=".55" />
      </motion.svg>
    </motion.span>
  );
}

/** A thread that sags a little between two points, like a real string. */
export function threadPath(a: Pt, b: Pt, sag = 0.12) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 + len * sag;
  const f = (n: number) => n.toFixed(1);
  return `M ${f(a.x)} ${f(a.y)} Q ${f(mx)} ${f(my)} ${f(b.x)} ${f(b.y)}`;
}

/**
 * Red thread between two pins. It draws itself on mount, when scrolled into
 * view, or along a scroll progress; once drawn it sways gently.
 */
export function Thread({
  a,
  b,
  sag = 0.12,
  delay = 0,
  duration = 0.9,
  reveal = "mount",
  progress,
  hot,
  sway = true,
  color,
}: {
  a: Pt;
  b: Pt;
  sag?: number;
  delay?: number;
  duration?: number;
  reveal?: Reveal;
  progress?: MotionValue<number>;
  hot?: boolean;
  sway?: boolean;
  color?: string;
}) {
  const d1 = threadPath(a, b, sag);
  const d2 = threadPath(a, b, sag + 0.04);
  const className = `jj-thread${hot ? " is-hot" : ""}`;
  if (progress) return <ProgressThread className={className} d={d1} progress={progress} color={color} />;
  const target = sway ? { pathLength: 1, d: [d1, d2, d1] } : { pathLength: 1 };
  const transition = {
    pathLength: { delay, duration, ease: [0.65, 0, 0.35, 1] as const },
    d: { delay: delay + duration, duration: 4.5, repeat: Infinity, ease: "easeInOut" as const },
  };
  const motionProps = reveal === "view" ? { initial: { pathLength: 0, d: d1 }, whileInView: target, viewport: { once: true, amount: 0.3 } } : { initial: { pathLength: 0, d: d1 }, animate: target };
  return (
    <g className={className}>
      <motion.path className="jj-thread-shadow" {...motionProps} transition={transition} />
      <motion.path className="jj-thread-line" {...motionProps} transition={transition} style={{ stroke: color }} />
    </g>
  );
}

function ProgressThread({ className, d, progress, color }: { className: string; d: string; progress: MotionValue<number>; color?: string }) {
  // Round caps would leave two dots while the length is zero.
  const opacity = useTransform(progress, [0, 0.02], [0, 1]);
  return (
    <motion.g className={className} style={{ opacity }}>
      <motion.path className="jj-thread-shadow" d={d} style={{ pathLength: progress }} />
      <motion.path className="jj-thread-line" d={d} style={{ pathLength: progress, stroke: color }} />
    </motion.g>
  );
}

/**
 * Measures where the pins sit inside a container, so threads can join pieces
 * laid out by CSS (grid, flex). Mark each pin spot with `data-anchor="id"` on
 * an element that does not move while animating.
 */
export function useAnchors<T extends HTMLElement>(watch: unknown = null) {
  const ref = useRef<T>(null);
  const [pts, setPts] = useState<Record<string, Pt>>({});
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const next: Record<string, Pt> = {};
    el.querySelectorAll<HTMLElement>("[data-anchor]").forEach((n) => {
      const r = n.getBoundingClientRect();
      next[n.dataset.anchor as string] = { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    });
    setPts((prev) => {
      const keys = Object.keys(next);
      const same = keys.length === Object.keys(prev).length && keys.every((k) => prev[k] && Math.abs(prev[k].x - next[k].x) < 0.5 && Math.abs(prev[k].y - next[k].y) < 0.5);
      return same ? prev : next;
    });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    const timers = [0, 400, 1200].map((t) => window.setTimeout(measure, t));
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => {
      ro.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [measure, watch]);
  return { ref, pts };
}

/** Full-size SVG layer for threads in a measured container; the threads run behind the papers, between the pins. */
export function ThreadLayer({ children }: { children: ReactNode }) {
  return (
    <svg className="jj-thread-layer is-behind" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Small yellow evidence marker with a number, as at a crime-scene photo. */
export function Tent({ n, delay = 0, reveal = "mount", style }: { n: number | string; delay?: number; reveal?: Reveal; style?: CSSProperties }) {
  const from = { opacity: 0, scale: 0.4, y: 12 };
  const to = { opacity: 1, scale: 1, y: 0 };
  const motionProps = reveal === "view" ? { initial: from, whileInView: to, viewport: { once: true } } : { initial: from, animate: to };
  return (
    <motion.span className="jj-tent" style={style} {...motionProps} transition={{ delay, type: "spring", stiffness: 420, damping: 16 }} aria-hidden="true">
      {n}
    </motion.span>
  );
}

/** Two strips of translucent tape holding a paper. */
export function Tape({ style }: { style?: CSSProperties }) {
  return <span className="jj-tape" style={style} aria-hidden="true" />;
}
