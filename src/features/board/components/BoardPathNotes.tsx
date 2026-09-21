import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { CONTRIBUTION_WORDING } from "../../../config/contributionWording";
import { formatMoment } from "../../onboarding-metrics/format";
import type { PathToFirstContributionContent } from "../types";

/**
 * The two things the path card says that nothing else on the board does.
 *
 * The card's strip of moments went when {@link BoardPathWindow} took over the "where am I" job —
 * the board answers how far along somebody is in four other places, and five labelled dots above
 * it were a fifth. These two lines are not that: they are hire-facing facts with no second home.
 *
 * The stall reason is shown to the person in the stall, not only to their PM: a stall only
 * somebody else can see is a stall only somebody else can fix. Autonomy is the day onboarding
 * ended, which is worth saying plainly once rather than leaving as a state the board drops out of.
 *
 * Both are single lines rather than panels — the header of a board somebody is working down stays
 * quiet even when it has something to say.
 */
export function BoardPathNotes({ content }: { content: PathToFirstContributionContent }) {
  const { autonomyReachedAt, stalledReason } = content;

  if (!stalledReason && !autonomyReachedAt) return null;

  return (
    <section aria-label="Where your onboarding stands" className="mt-4 space-y-2">
      {stalledReason && (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-app-warning-text">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            Something is waiting: {stalledReason}. Ask your buddy about it — this is the kind of
            thing a person unblocks in a minute.
          </span>
        </p>
      )}

      {autonomyReachedAt && (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-app-success-text">
          <CheckCircle2 className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            You worked unsupervised here on {formatMoment(autonomyReachedAt)} — a{" "}
            {CONTRIBUTION_WORDING.noun} accepted with no rework and no one stepping in. Onboarding
            ended that day.
          </span>
        </p>
      )}
    </section>
  );
}
