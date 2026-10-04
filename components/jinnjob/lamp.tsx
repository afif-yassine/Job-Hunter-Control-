type LampProps = {
  /** Width in px; height follows the 84×62 drawing. */
  size?: number;
  /** Lamp colour. */
  color?: string;
  /** Background colour behind the lamp: draws the lid line and the highlight. */
  cut?: string;
  /** Smoke and wish-star colour. */
  accent?: string;
  /** Faster smoke and a shaking lamp: the "searching" state. */
  busy?: boolean;
  className?: string;
  title?: string;
};

/** The JinnJob mark: a genie lamp whose smoke ends in a wish-star. Animated in CSS (app/jinnjob.css). */
export function Lamp({ size = 44, color = "#1f1a14", cut = "#f3ecdc", accent = "#7b2d26", busy, className, title }: LampProps) {
  return (
    <svg
      viewBox="0 0 84 62"
      width={size}
      height={Math.round((size * 62) / 84)}
      className={["jj-lamp", busy ? "is-fast" : "", className ?? ""].join(" ").trim()}
      style={{ color }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g className="ll-lamp">
        <path className="ll-body" d="M15 41 H61 C58 51 47 54 38 54 C29 54 18 51 15 41 Z" />
        <path className="ll-body" d="M58 41 C64 41 69 37 75 31 C73 39 67 47 56 48 Z" />
        <path className="ll-body" d="M27 41 C27 35 32 32 38 32 C44 32 49 35 49 41 Z" />
        <circle className="ll-body" cx="38" cy="29.5" r="2.4" />
        <path className="ll-body" d="M31 53 H45 L47.5 58 H28.5 Z" />
        <path className="ll-line" d="M17 44 C8 45 5 38 10 34.5 C13 32.5 16.5 34.5 16 38" />
        <path className="ll-cut" d="M15.5 41 H60.5" style={{ stroke: cut }} />
        <path className="ll-cut" d="M22 45.5 C27 49.5 33 50.5 38 50.5" style={{ stroke: cut, opacity: 0.55 }} />
        <path className="ll-cut ll-glint" d="M22 45.5 C27 49.5 33 50.5 38 50.5" style={{ stroke: "#d9b86a" }} />
      </g>
      <path className="ll-smoke" d="M75 28.5 C80 23 70 19 74 12 C76.5 7.5 73 4.5 69 5" style={{ stroke: accent }} />
      <path className="ll-star" d="M62 0.5 L63.4 4.1 L67 5.5 L63.4 6.9 L62 10.5 L60.6 6.9 L57 5.5 L60.6 4.1 Z" style={{ fill: accent }} />
    </svg>
  );
}

/** "JinnJob" set in the old printing face, "Job" in italic leather red. */
export function Wordmark({ size = 30, dark }: { size?: number; dark?: boolean }) {
  return (
    <span className="jj-word" style={{ fontSize: size, color: dark ? "#f3ecdc" : undefined }}>
      Jinn<em style={{ color: dark ? "#e4b9a9" : undefined }}>Job</em>
    </span>
  );
}
