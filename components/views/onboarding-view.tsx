"use client";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Mark, Wordmark } from "@/components/jinnjob/logo";
import { ONBOARDING_TEXT, readyText, STEPS, stepLabel, type OnboardingStep } from "@/components/onboarding";
import { ProfileImportFlow } from "@/components/profile-import-flow";
import { SearchBasics, split, useSearchPrefs } from "@/components/search-fields";
import { Callout } from "@/components/ui";
import { todayBatchSize, parisDay } from "@/components/unlock";
import type { Ctx } from "./types";

/**
 * The guided sign-up: full screen, before the dashboard, with no way to skip a step. The CV and the search fields
 * are the very components of Réglages. Each step stays usable when something fails: the message is on the screen,
 * and the same button tries again.
 */
export function OnboardingView({
  ctx,
  start,
  onFinish,
  onRefreshSelection,
}: {
  ctx: Ctx;
  start: "cv" | "search";
  onFinish: () => void;
  onRefreshSelection: () => void;
}) {
  const [step, setStep] = useState<OnboardingStep>(start);
  const index = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="onb">
      <header className="onb-head">
        <span className="brand-logo" role="img" aria-label="LeBonTaf">
          <span className="lbt-logo">
            <Mark size={32} />
            <Wordmark size={24} />
          </span>
        </span>
        <form action={logout}>
          <button className="btn ghost small">{ONBOARDING_TEXT.logout}</button>
        </form>
      </header>
      <main className="onb-main">
        <p className="onb-step" aria-live="polite">
          {stepLabel(step)}
        </p>
        <div className="onb-bar" role="presentation">
          {STEPS.map((s, i) => (
            <span key={s.id} className={i <= index ? "is-on" : undefined} />
          ))}
        </div>
        {step === "cv" && (
          <>
            <h1>{ONBOARDING_TEXT.cv.title}</h1>
            <p className="muted">{ONBOARDING_TEXT.cv.lead}</p>
            <ProfileImportFlow ctx={ctx} onCategories={() => undefined} onSaved={() => setStep("search")} />
          </>
        )}
        {step === "search" && <SearchStep ctx={ctx} onSaved={() => setStep("ready")} />}
        {step === "ready" && <ReadyStep ctx={ctx} onFinish={onFinish} onRefreshSelection={onRefreshSelection} />}
      </main>
    </div>
  );
}

function SearchStep({ ctx, onSaved }: { ctx: Ctx; onSaved: () => void }) {
  const s = useSearchPrefs(ctx);
  const [failed, setFailed] = useState(false);
  const chosen = (s.prefs.categories ?? []).length > 0 || split(s.keywords).length > 0;
  const { search } = ONBOARDING_TEXT;
  return (
    <>
      <h1>{search.title}</h1>
      <p className="muted">{search.lead}</p>
      {s.loadFailed ? (
        <Callout tone="bad" title={search.unreadable}>
          <button className="btn secondary small" onClick={() => window.location.reload()}>
            Recharger la page
          </button>
        </Callout>
      ) : (
        <form
          className="card form searchform"
          onSubmit={(e) => {
            e.preventDefault();
            if (!chosen || s.saving) return;
            setFailed(false);
            void s.save().then((ok) => (ok ? onSaved() : setFailed(true)));
          }}
        >
          <SearchBasics s={s} />
          {failed && (
            <div className="wide">
              <Callout tone="bad" title={search.failed}>
                Vérifie ta connexion, puis appuie de nouveau sur le bouton.
              </Callout>
            </div>
          )}
          <div className="wide toolbar">
            <button className="btn" disabled={!s.loaded || s.saving || !chosen}>
              {s.saving ? <LoaderCircle size={16} className="spin" aria-hidden /> : null} {search.action}
            </button>
            {s.loaded && !chosen && <span className="muted small-text">{search.need}</span>}
          </div>
        </form>
      )}
    </>
  );
}

function ReadyStep({ ctx, onFinish, onRefreshSelection }: { ctx: Ctx; onFinish: () => void; onRefreshSelection: () => void }) {
  // The first selection is read again now that the search is saved.
  useEffect(() => {
    onRefreshSelection();
  }, [onRefreshSelection]);
  const batch = ctx.unlock.kind === "locking" ? todayBatchSize(ctx.unlock, parisDay()) : null;
  return (
    <>
      <h1>{ONBOARDING_TEXT.ready.title}</h1>
      <p className="muted" role="status">
        {readyText(batch)}
      </p>
      <div className="toolbar">
        <button className="btn" onClick={onFinish}>
          {ONBOARDING_TEXT.ready.action}
        </button>
      </div>
    </>
  );
}
