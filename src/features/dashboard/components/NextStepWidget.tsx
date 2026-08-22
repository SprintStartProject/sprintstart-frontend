import { Spinner } from "../../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Brain, ClipboardCheck, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ClickableCard } from "../../../components/common/ClickableCard";
import type { MyOnboardingStatus } from "../../onboarding/hooks/useMyOnboardingStatus";
import type { OnboardingNextAction } from "../../onboarding/nextAction";

/** The ring at a card's full width, and the one that still fits a quarter-row card. */
const RING_SIZE = 104;
const COMPACT_RING_SIZE = 76;
const RING_STROKE = 9;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Circular progress ring with a brand gradient stroke.
 *
 * Animated with a plain CSS transition rather than framer-motion: the test
 * harness only mocks `motion` for a fixed list of HTML tags, so `motion.circle`
 * resolves to undefined there.
 */
function ProgressRing({ percentage, compact }: { percentage: number; compact: boolean }) {
  const offset = RING_CIRCUMFERENCE * (1 - percentage / 100);
  const size = compact ? COMPACT_RING_SIZE : RING_SIZE;
  // The geometry is authored at `RING_SIZE`; the viewBox scales the whole drawing, so the
  // stroke thins with it instead of turning a small ring into a thick doughnut.
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <defs>
          <linearGradient id="next-step-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--progress-fill)" />
            <stop offset="100%" stopColor="var(--progress-fill-end)" />
          </linearGradient>
        </defs>

        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          stroke="var(--progress-track)"
        />

        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          stroke="url(#next-step-ring)"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 900ms ease-out",
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-bold text-app-text tabular-nums ${compact ? "text-lg" : "text-2xl"}`}
        >
          {percentage}%
        </span>
        <span className="text-[10px] font-medium tracking-wide text-app-text-muted uppercase">
          done
        </span>
      </div>
    </div>
  );
}

/** Everything the card renders about one next action, and where clicking it leads. */
type CardContent = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle: string | null;
  cta: string;
  ariaLabel: string;
  to: string;
  /**
   * Handed to the onboarding page through the router, which uses it to put the thing the
   * user came for in front of them instead of dropping them at the top of the page.
   */
  navigationState?: { focusCheckPhaseId?: string; openReviewCheck?: boolean };
};

function pluralize(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function describeNextAction(action: Exclude<OnboardingNextAction, { kind: "done" }>): CardContent {
  switch (action.kind) {
    case "step":
      return {
        icon: Rocket,
        eyebrow: "Next up",
        title: action.step.title,
        subtitle: action.phase.title,
        // A step that was never opened is started, not continued — and starting one is
        // what the onboarding page celebrates, so the wording has to match.
        cta: action.step.status === "WAITING" ? "Start" : "Continue",
        ariaLabel: `Continue onboarding: ${action.step.title}`,
        to: `/onboarding/${action.step.id}`,
      };

    case "check":
      return {
        icon: ClipboardCheck,
        eyebrow: "Knowledge check",
        title: `${action.phase.title} check`,
        subtitle: action.isFinalPhase
          ? "Every step done — pass it to finish your onboarding"
          : "Every step done — pass it to unlock the next phase",
        cta: "Open check",
        ariaLabel: `Open the knowledge check for ${action.phase.title}`,
        to: "/onboarding",
        navigationState: { focusCheckPhaseId: action.phase.id },
      };

    case "review":
      return {
        icon: Brain,
        eyebrow: "Review questions",
        title: `${pluralize(action.openCount, "question")} to answer again`,
        subtitle: "Answer them correctly once to finish your onboarding",
        cta: "Test your knowledge",
        ariaLabel: "Answer your open review questions",
        to: "/onboarding",
        navigationState: { openReviewCheck: true },
      };
  }
}

const CARD_CLASS_NAME =
  "group relative flex h-full flex-col overflow-hidden rounded-2xl p-6 transition-all";

/**
 * The signed-in user's own position in their onboarding: overall progress and the one
 * thing waiting for them, which is what clicking the card opens.
 *
 * Renders nothing when there is no live journey to report — that decision belongs to the
 * dashboard, which has another card for the slot, so the states are handed in rather than
 * fetched here (see {@link useMyOnboardingStatus}). The next action is resolved from the
 * path itself, not from the team overview's `currentStep`: that field ignores phase locks
 * and would send someone with an unpassed knowledge check straight into the next phase.
 */
export function NextStepWidget({
  status,
  compact = false,
}: {
  status: MyOnboardingStatus;
  compact?: boolean;
}) {
  const navigate = useNavigate();

  if (status.state === "loading") {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl p-6">
        <Spinner size="lg" label="Loading" />
      </div>
    );
  }

  if (status.state === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl p-6 text-center">
        <AlertCircle className="h-5 w-5 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">Could not load your onboarding progress.</p>
      </div>
    );
  }

  // `absent`, and a journey with nothing left, are the dashboard's cue to show something
  // else in this slot. Guarded here too so the component is safe to render on its own.
  if (status.state !== "ready" || status.nextAction.kind === "done") {
    return null;
  }

  const content = describeNextAction(status.nextAction);
  const Icon = content.icon;

  return (
    <ClickableCard
      onClick={() => void navigate(content.to, { state: content.navigationState })}
      aria-label={content.ariaLabel}
      className={`${CARD_CLASS_NAME} cursor-pointer hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-app-brand/10 blur-2xl"
      />

      <div className="relative mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold text-app-text">Your onboarding</span>
        </div>

        <span
          aria-hidden="true"
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-app-text-muted transition-all group-hover:translate-x-0.5 group-hover:text-app-brand-text"
        >
          {content.cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Stacked and centred when the card is a quarter of a row: at that width a ring with
          text beside it leaves neither enough room, and the cell's fixed height gives the
          stack somewhere to sit. */}
      <div
        className={`relative flex flex-1 ${
          compact ? "flex-col items-center justify-center gap-3 text-center" : "items-center gap-5"
        }`}
      >
        <ProgressRing percentage={status.progress.percentage} compact={compact} />

        <div className={compact ? "max-w-full min-w-0" : "min-w-0 flex-1"}>
          {/* The eyebrow names the kind of action; at this size the title says it anyway. */}
          {!compact && (
            <p className="text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
              {content.eyebrow}
            </p>
          )}
          <p
            className={`line-clamp-2 leading-snug font-semibold text-app-text ${
              compact ? "text-base" : "mt-1 text-lg"
            }`}
          >
            {content.title}
          </p>
          {/* The subtitle is the first thing to go when the card is a quarter of a row: it
              explains the next action, which the title has already named. */}
          {content.subtitle && !compact && (
            <p className="mt-1 line-clamp-2 text-sm text-app-text-muted">{content.subtitle}</p>
          )}
        </div>
      </div>
    </ClickableCard>
  );
}
