import { useEffect, useState } from "react";
import { Spinner } from "../../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Check, Rocket } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { useAuth } from "../../../context/useAuth";
import { isOnboardingAccessible } from "../../../auth/accessPolicy";
import { getMyTeamOverview } from "../../../services/teamManagementService";
import type { TeamOverviewUser } from "../../team-management/types";

const RING_SIZE = 104;
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
function ProgressRing({ percentage }: { percentage: number }) {
    const offset = RING_CIRCUMFERENCE * (1 - percentage / 100);

    return (
        <div
            className="relative shrink-0"
            style={{ width: RING_SIZE, height: RING_SIZE }}
        >
            <svg
                width={RING_SIZE}
                height={RING_SIZE}
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
                <span className="text-2xl font-bold tabular-nums text-app-text">
                    {percentage}%
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-app-text-muted">
                    done
                </span>
            </div>
        </div>
    );
}

/**
 * Shows the signed-in user's own onboarding position: the step they are
 * currently on, the phase it belongs to, overall progress and the project
 * roles assigned to them.
 *
 * Reads `/api/v1/onboarding/me/team-overview`, which is open to the USER
 * role — unlike the PM-facing team overview used on the PM dashboard.
 */
export function NextStepWidget() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [user, setUser] = useState<TeamOverviewUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isCurrentRequest = true;

        async function loadOverview() {
            try {
                const data = await getMyTeamOverview();
                if (!isCurrentRequest) return;

                setUser(data);
            } catch {
                if (!isCurrentRequest) return;

                setError(true);
            } finally {
                if (isCurrentRequest) {
                    setLoading(false);
                }
            }
        }

        void loadOverview();

        return () => {
            isCurrentRequest = false;
        };
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-56 items-center justify-center rounded-2xl border border-app-border bg-app-surface p-6">
                <Spinner size="lg" label="Loading" />
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-app-border bg-app-surface p-6 text-center">
                <AlertCircle className="h-5 w-5 text-app-text-muted" />
                <p className="text-sm text-app-text-muted">
                    Could not load your onboarding progress.
                </p>
            </div>
        );
    }

    const progressPercentage = Math.round(user.progressPercentage * 100);
    const isComplete = progressPercentage >= 100;

    // Completed users are bounced off /onboarding by the auth guard, so the
    // card must not advertise a destination they cannot reach.
    const canOpenOnboarding = isOnboardingAccessible(profile);
    const stepId = user.currentStep?.id;
    const target = stepId ? `/onboarding/${stepId}` : "/onboarding";

    const cardClassName = `group relative flex min-h-56 flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface p-6 transition-all ${
        canOpenOnboarding
            ? "cursor-pointer hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
            : ""
    }`;

    const body = (
        <>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-app-brand/10 blur-2xl"
            />

            <div className="relative mb-5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm">
                        <Rocket className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-semibold text-app-text">
                        Your onboarding
                    </span>
                </div>

                {canOpenOnboarding && (
                    <span
                        aria-hidden="true"
                        className="flex shrink-0 items-center gap-1 text-xs font-medium text-app-text-muted transition-all group-hover:translate-x-0.5 group-hover:text-app-brand-text"
                    >
                        {stepId ? "Continue" : "Open"}
                        <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                )}
            </div>

            <div className="relative flex flex-1 items-center gap-5">
                <ProgressRing percentage={progressPercentage} />

                <div className="min-w-0 flex-1">
                    {isComplete ? (
                        <>
                            <Badge variant="success" className="gap-1.5">
                                <Check className="h-3.5 w-3.5" />
                                All steps done
                            </Badge>
                            <p className="mt-2 text-sm text-app-text-muted">
                                Nice work — your onboarding is complete.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-app-brand-text">
                                Next up
                            </p>
                            <p className="mt-1 line-clamp-2 text-lg font-semibold leading-snug text-app-text">
                                {user.currentStep?.title ?? "No current step"}
                            </p>
                            {user.currentPhase?.title && (
                                <p className="mt-1 truncate text-sm text-app-text-muted">
                                    {user.currentPhase.title}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );

    if (!canOpenOnboarding) {
        return <div className={cardClassName}>{body}</div>;
    }

    return (
        <ClickableCard
            onClick={() => void navigate(target)}
            aria-label={
                stepId
                    ? `Continue onboarding: ${user.currentStep?.title ?? "current step"}`
                    : "Open onboarding"
            }
            className={cardClassName}
        >
            {body}
        </ClickableCard>
    );
}
