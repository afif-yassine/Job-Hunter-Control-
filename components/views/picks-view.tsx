"use client";
import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Callout, Empty, PageHead } from "@/components/ui";
import { COMPUTING_TEXT, DEGRADED_TEXT, groupByUnlockDay, lockedCount, parisDay, todayBatchSize } from "@/components/unlock";
import { kitsByJob, stageOf } from "@/lib/journey";
import type { Job } from "@/lib/types";
import { monthBanner } from "@/components/panel-notes";
import { pricingHref } from "@/components/pricing";
import { PlusOfferCard } from "@/components/plus-offer-card";
import { afterBannerClosed, canShowBanner, kitsUsedUp, plusEligible, winningMoment, type PlusMoment } from "@/components/plus-offer";
import { cardsToShow, PLUS_BUTTON } from "@/components/teaser-cards";
import { usePlusStore } from "@/components/use-plus-store";
import { LockedTeaser } from "./locked-teaser";
import { OfferCard } from "./offer-card";
import type { Ctx } from "./types";

/**
 * "Pour toi": the student's selection. The day's batch first (numbered by score), then what was unlocked on
 * earlier days, then what the account already had, folded. Locked offers are not listed here: a few drawn
 * silhouettes say there is more to come. A student has no other list of offers than this one.
 */
export function PicksView({ ctx }: { ctx: Ctx }) {
  const { data, unlock, openOffer, act } = ctx;
  const kits = useMemo(() => kitsByJob(data.documents), [data.documents]);
  const today = useMemo(() => parisDay(), []);

  // Offers the student put aside stay in "Mon suivi", not here.
  const visible = useMemo(() => data.jobs.filter((j) => stageOf(j) !== "dismissed"), [data.jobs]);
  const hasKit = (job: Job) => kits.has(job.id);
  const groups = useMemo(
    () => groupByUnlockDay(visible, unlock, (job) => kits.has(job.id), today),
    [visible, unlock, kits, today],
  );
  const batch = todayBatchSize(unlock, today);
  const locked = lockedCount(data.jobs, unlock, hasKit);
  const todayGroup = groups.find((g) => g.kind === "day" && g.day === today);
  const earlier = groups.filter((g) => g.kind === "day" && g.day !== today);
  const folded = groups.filter((g) => g.kind !== "day");

  // Plus is proposed to a free account only (see components/plus-offer.ts); any doubt shows nothing.
  const eligible = plusEligible({ pricing: ctx.pricing, demo: ctx.demo, onboarding: false, isAdmin: ctx.status?.isAdmin === true, plan: ctx.status?.plan, unlock });
  const cards = eligible && unlock.kind === "locking" ? cardsToShow(unlock.teaser) : [];
  const more = unlock.kind === "locking" && unlock.teaser ? unlock.teaser.more : 0;
  // Moment "fin": every offer of the day was opened, kept or put aside.
  const dayDone = Boolean(todayGroup && todayGroup.jobs.length > 0 && todayGroup.jobs.every((j) => stageOf(j) !== "new"));
  const plus = usePlusStore();
  const plan = ctx.status?.plan;
  const wantsBanner = eligible && plus.ready && kitsUsedUp(plan) && canShowBanner(plus.store, today);
  // One Plus block per screen: the cards (or the end of the day) win over the banner.
  const candidates: PlusMoment[] = [];
  if (cards.length > 0) candidates.push(dayDone ? "fin" : "cartes");
  if (wantsBanner) candidates.push("bandeau");
  const shown = winningMoment(candidates);

  return (
    <>
      <PageHead
        title="Offres"
        subtitle="Ta sélection du jour et celles que tu as déjà reçues. Clique une offre pour lire l’essentiel et préparer ta candidature."
        actions={
          <button className="btn secondary" onClick={act.addJob}>
            <Plus size={16} aria-hidden /> Ajouter une offre
          </button>
        }
      />

      {shown === "bandeau" && plan && plan.limit !== null && (
        <PlusOfferCard
          title={monthBanner(plan.limit, plan.resetsOn).title}
          action={PLUS_BUTTON}
          href={pricingHref("bandeau")}
          onClose={() => plus.update((s) => afterBannerClosed(s, today))}
        >
          {monthBanner(plan.limit, plan.resetsOn).text}
        </PlusOfferCard>
      )}

      {todayGroup && (
        <section className="picks-section" aria-labelledby="picks-today">
          <h2 id="picks-today" className="section-title">
            {todayGroup.label}
          </h2>
          <div className="offers">
            {todayGroup.jobs.map((job, i) => (
              <OfferCard key={job.id} job={job} kit={kits.get(job.id)} rank={i + 1} onOpen={openOffer} />
            ))}
          </div>
        </section>
      )}

      {unlock.kind === "locking" && unlock.computing ? (
        <Callout
          tone="info"
          title={COMPUTING_TEXT}
          action={
            <button className="btn secondary small" onClick={ctx.refreshSelection}>
              Réessayer
            </button>
          }
        >
          Ça peut prendre une minute. Les offres que tu as déjà reçues restent là.
        </Callout>
      ) : unlock.kind === "locking" && unlock.degraded ? (
        <Callout
          tone="warn"
          title={DEGRADED_TEXT}
          action={
            <button className="btn secondary small" onClick={ctx.refreshSelection}>
              Réessayer
            </button>
          }
        >
          Les offres que tu as déjà reçues restent là.
        </Callout>
      ) : (
        <LockedTeaser
          batch={batch}
          locked={locked}
          onSettings={() => ctx.go("settings")}
          cards={shown === "cartes" || shown === "fin" ? cards : []}
          more={more}
          phase={shown === "fin" ? "end" : "more"}
        />
      )}

      {!todayGroup && groups.length === 0 && <Empty title="Rien à montrer pour l’instant" text="Tes offres arrivent dès qu’elles sont choisies pour toi." />}

      {earlier.map((group) => (
        <section key={group.key} className="picks-section" aria-labelledby={`picks-${group.key}`}>
          <h2 id={`picks-${group.key}`} className="section-title">
            {group.label}
          </h2>
          <div className="offers">
            {group.jobs.map((job) => (
              <OfferCard key={job.id} job={job} kit={kits.get(job.id)} onOpen={openOffer} />
            ))}
          </div>
        </section>
      ))}

      {folded.map((group) => (
        <details key={group.key} className="picks-fold">
          <summary>
            {group.label} <span className="count">{group.jobs.length}</span>
          </summary>
          <div className="offers">
            {group.jobs.map((job) => (
              <OfferCard key={job.id} job={job} kit={kits.get(job.id)} onOpen={openOffer} />
            ))}
          </div>
        </details>
      ))}
    </>
  );
}
