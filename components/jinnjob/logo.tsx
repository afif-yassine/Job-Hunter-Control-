type MarkProps = {
  /** Width in px (the drawing is square). */
  size?: number;
  /** Plays the arrival animation (frame draws, arrow springs out). */
  intro?: boolean;
  /** Arrow keeps leaving the frame: the "searching" state. */
  busy?: boolean;
  /** Shapes only, without the dark tile (for dark backgrounds). */
  bare?: boolean;
  className?: string;
  title?: string;
};

/**
 * The LeBonTaf mark: a frame (where you are) and an arrow leaving it toward
 * the top right — "ton bon départ". Animated in CSS (app/jinnjob.css).
 */
export function Mark({ size = 40, intro = true, busy, bare, className, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={["lbt-mark", intro ? "is-intro" : "", busy ? "is-busy" : "", className ?? ""].join(" ").trim()}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {!bare && <rect className="mk-tile" width="48" height="48" rx="11" />}
      <g transform={bare ? undefined : "translate(7.2 7.2) scale(.7)"}>
        <path className="mk-frame" d="M4 4 H15 V33 H44 V44 H18 A14 14 0 0 1 4 30 Z" />
        <g className="mk-arrow">
          <path d="M22 4 H44 V26 H35 V13 H22 Z" />
          <path d="M20.6 25.6 L31.2 15 L36 19.8 L25.4 30.4 Z" />
        </g>
      </g>
    </svg>
  );
}

/** "lebon" in the bold grotesque, "taf" in an italic serif, and a full stop. */
export function Wordmark({ size = 28, dark }: { size?: number; dark?: boolean }) {
  return (
    <span className={`lbt-word${dark ? " is-dark" : ""}`} style={{ fontSize: size }}>
      lebon<em>taf</em>
      <i>.</i>
    </span>
  );
}

/** Mark and wordmark together, as one logo. */
export function Logo({ size = 36, dark, intro = true }: { size?: number; dark?: boolean; intro?: boolean }) {
  return (
    <span className="lbt-logo">
      <Mark size={size} intro={intro} />
      <Wordmark size={Math.round(size * 0.78)} dark={dark} />
    </span>
  );
}
