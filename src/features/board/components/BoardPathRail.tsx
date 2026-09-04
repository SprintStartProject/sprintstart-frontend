import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { CONTRIBUTION_WORDING } from "../../../config/contributionWording";
import { formatMoment } from "../../onboarding-metrics/format";
import { momentLabel } from "../momentLabels";
import type { PathToFirstContributionContent } from "../types";

type BoardPathRailProps = {
  content: PathToFirstContributionContent;
};

/**
 * The path from joining to a first accepted piece of work, as a thin rail under the page title.
 *
 * The same content the path card holds, drawn as page furniture instead of as one card among
 * eleven. It earns that place: it is the only thing on the board that says where the hire is
 * overall, and every other card is a detail of some part of it.
 *
 * **Deliberately quiet.** No heading, no summary line, no rule above it — the moments name
 * themselves, and a title saying "Your path here" over five labelled dots is a label for a label.
 * It is a strip you read on the way past, not a section that asks for attention. The accessible
 * name lives on the region instead, so a screen reader still gets told what the strip is.
 *
 * Horizontal because the thing being drawn is a sequence in time, and a row reads as one — a
 * column of five dots reads as a list of five separate facts.
 *
 * An unreached moment is a hollow dot and a dash — never a zero, and never a "3 of 5". A milestone
 * that has not happened is not a milestone reached instantly, and a count of them is the blended
 * completion figure this product does not draw.
 *
 * **Not dismissible.** It is part of the header now rather than a card on the board, and the one
 * thing on the page that says where the hire stands is not something to lose by clicking an X next
 * to it. The card behind it stays dismissible from the grid on any board that still shows it there.
 *
 * The stall reason is shown to the person in the stall, not only to their PM: a stall only somebody
 * else can see is a stall only somebody else can fix. It is one amber line rather than a filled
 * panel — the strip has to stay quiet even when it has something to say.
 */
export function BoardPathRail({ content }: BoardPathRailProps) {
  const { moments, autonomyReachedAt, stalledReason } = content;

  return (
    <section aria-label="Your path here" className="mt-5" data-testid="board-path-rail">
      <ol className="flex flex-wrap gap-y-3">
        {moments.map((moment, index) => {
          const reached = moment.reachedAt !== null;
          // The connector belongs to the gap after this dot, so it lights only once the moment on
          // its far side has actually happened.
          const isLast = index === moments.length - 1;
          const nextReached = !isLast && moments[index + 1].reachedAt !== null;

          return (
            <li key={moment.key} className="flex min-w-32 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-1.5 pr-2">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    reached ? "bg-app-brand" : "border border-app-border-strong bg-transparent"
                  }`}
                />
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`h-px flex-1 ${nextReached ? "bg-app-brand" : "bg-app-border"}`}
                  />
                )}
              </div>

              <p className="pr-4 text-[11px] leading-tight">
                <span className={reached ? "text-app-text" : "text-app-text-muted"}>
                  {momentLabel(moment.key)}
                </span>
                <span className="ml-1.5 text-app-text-subtle tabular-nums">
                  {formatMoment(moment.reachedAt)}
                </span>
              </p>
            </li>
          );
        })}
      </ol>

      {stalledReason && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-app-warning-text">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            Something is waiting: {stalledReason}. Ask your buddy about it — this is the kind of
            thing a person unblocks in a minute.
          </span>
        </p>
      )}

      {autonomyReachedAt && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-app-success-text">
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
