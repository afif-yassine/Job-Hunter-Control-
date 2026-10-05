type MarkProps = {
  /** Width in px (the drawing is square). */
  size?: number;
  /** Colour of the pin head and of the thread. */
  color?: string;
  /** Colour of the second pin and the needle. */
  ink?: string;
  /** Livelier thread: the "searching" state. */
  busy?: boolean;
  className?: string;
  title?: string;
};

/**
 * The LeBonTaf mark: a red push-pin whose thread runs to a second pin, the
 * way a detective links two clues on a board. Animated in CSS (app/jinnjob.css).
 */
export function Mark({ size = 44, color = "#d2372c", ink = "#1c1a17", busy, className, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={["jj-mark", busy ? "is-busy" : "", className ?? ""].join(" ").trim()}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path className="mk-thread-shadow" d="M20 22 C 30 46, 44 48, 50 44" />
      <path className="mk-thread" d="M20 20 C 30 44, 44 46, 50 42" style={{ stroke: color }} />
      <g className="mk-pin2">
        <path d="M50 42 L56 52" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="50" cy="42" r="6.2" fill={ink} />
        <circle cx="48" cy="40" r="1.8" fill="#fff" opacity=".45" />
      </g>
      <g className="mk-pin">
        <path d="M20 20 L12 34" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="20" cy="18" r="11" fill={color} />
        <path d="M11.5 22 A 11 11 0 0 0 29 23" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="3" />
        <circle cx="16" cy="14" r="3.2" fill="#fff" opacity=".5" />
      </g>
    </svg>
  );
}

/** "LeBonTaf" in the bold grotesque, "Taf" in thread red. */
export function Wordmark({ size = 28, dark }: { size?: number; dark?: boolean }) {
  return (
    <span className="jj-word" style={{ fontSize: size, color: dark ? "#f4f1ea" : undefined }}>
      LeBon<em style={{ color: dark ? "#ff8a7a" : undefined }}>Taf</em>
    </span>
  );
}
