import type { ReactNode } from "react";
import { Check, CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { Tone } from "@/lib/labels";

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="score none" title="Pas encore analysée">—</span>;
  const tone = score >= 80 ? "good" : score >= 60 ? "mid" : "low";
  return (
    <span className={`score ${tone}`} title={`Compatibilité ${score}/100`}>
      {score}
      <small>/100</small>
    </span>
  );
}

export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="pagehead">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="toolbar">{actions}</div>}
    </div>
  );
}

export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

const ICONS = { info: Info, good: Check, warn: TriangleAlert, bad: CircleAlert, neutral: Info };

export function Callout({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "good" | "warn" | "bad";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = ICONS[tone];
  return (
    <div className={`callout ${tone}`}>
      <Icon size={18} aria-hidden />
      <div className="callout-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <span style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
    </div>
  );
}
