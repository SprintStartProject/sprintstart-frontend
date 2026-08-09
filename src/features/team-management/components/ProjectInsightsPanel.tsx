import { Database, FileStack, Inbox, TrendingUp } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { STALLED_AFTER_DAYS, type ProjectInsights } from '../useProjectInsights';

type ProjectInsightsPanelProps = {
    insights: ProjectInsights;
};

/** "2h ago" style label; absolute dates say less than elapsed time here. */
function formatElapsed(timestamp: string): string {
    const elapsedMs = Date.now() - new Date(timestamp).getTime();
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));

    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;

    return `${Math.floor(hours / 24)}d ago`;
}

function latestRun(
    sources: NonNullable<ProjectInsights['sources']>,
): string | null {
    const timestamps = sources
        .map((source) => source.lastRunTime)
        .filter((value): value is string => Boolean(value));

    if (timestamps.length === 0) return null;

    return timestamps.reduce((latest, current) =>
        new Date(current) > new Date(latest) ? current : latest,
    );
}

/**
 * One labelled line in the details column.
 *
 * Label and value share a row so four blocks fit next to the member list rather
 * than doubling the widget's height; only a value that is itself a list wraps
 * onto the next line.
 */
function InsightRow({
    icon,
    label,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="flex shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-app-text-muted">
                {icon}
                {label}
            </dt>
            <dd className="min-w-0 text-sm text-app-text">{children}</dd>
        </div>
    );
}

/**
 * The figures a manager would otherwise have to visit three other pages for.
 *
 * Blocks whose request failed are absent rather than showing a zero, because
 * "no open requests" and "could not load the requests" must not look the same.
 *
 * The ingestion block deliberately summarizes rather than listing repositories:
 * the connected sources are already named right above it in the project's own
 * details, and repeating them would say the same thing twice.
 */
export function ProjectInsightsPanel({ insights }: ProjectInsightsPanelProps) {
    const { sources, attention, averageProgress, artifactCount } = insights;

    const connectedSources =
        sources?.filter((source) => source.connectionStatus === 'CONNECTED')
            .length ?? 0;
    const failedSources =
        sources?.filter((source) => source.connectionStatus === 'FAILED')
            .length ?? 0;
    const lastRun = sources ? latestRun(sources) : null;

    const openSkipRequests =
        attention?.filter((item) => item.hasOpenSkipRequest).length ?? 0;
    const unreadFeedback =
        attention?.filter((item) => item.hasUnreadFeedback).length ?? 0;
    const waitingCount = openSkipRequests + unreadFeedback;
    const stalledMembers =
        attention?.filter((item) => item.daysOnCurrentStep > STALLED_AFTER_DAYS)
            .length ?? 0;

    return (
        <>
            {attention !== null && (
                <InsightRow
                    icon={
                        <Inbox
                            className={`h-3.5 w-3.5 ${
                                waitingCount > 0 ? 'text-app-warning-text' : ''
                            }`}
                            aria-hidden="true"
                        />
                    }
                    label="Waiting for you"
                >
                    {waitingCount === 0 ? (
                        <span className="text-app-text-muted">
                            Nothing waiting
                        </span>
                    ) : (
                        // Counts, not names: this column answers "is there
                        // anything to do here", and the people involved are
                        // listed on the pages that let you act on them.
                        <span className="flex flex-wrap items-center gap-2">
                            {openSkipRequests > 0 && (
                                <Badge variant="warning">
                                    Open skip requests ({openSkipRequests})
                                </Badge>
                            )}
                            {unreadFeedback > 0 && (
                                <Badge variant="brand">
                                    Unread feedback ({unreadFeedback})
                                </Badge>
                            )}
                        </span>
                    )}
                </InsightRow>
            )}

            {sources !== null && (
                <InsightRow
                    icon={<Database className="h-3.5 w-3.5" aria-hidden="true" />}
                    label="Data ingestion"
                >
                    <span className="flex flex-wrap items-center gap-2">
                        <span>
                            {sources.length === 0
                                ? 'Nothing connected'
                                : `${connectedSources} of ${sources.length} connected`}
                            {lastRun && ` · last run ${formatElapsed(lastRun)}`}
                        </span>
                        {failedSources > 0 && (
                            <Badge variant="danger">
                                {failedSources} failed
                            </Badge>
                        )}
                    </span>
                </InsightRow>
            )}

            {averageProgress !== null && (
                <InsightRow
                    icon={
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                    }
                    label="Onboarding"
                >
                    <span className="flex flex-wrap items-center gap-2">
                        <span>{Math.round(averageProgress * 100)}% average</span>
                        {stalledMembers > 0 && (
                            <Badge variant="neutral">
                                {stalledMembers} over {STALLED_AFTER_DAYS}d on
                                one step
                            </Badge>
                        )}
                    </span>
                </InsightRow>
            )}

            {artifactCount !== null && (
                <InsightRow
                    icon={
                        <FileStack className="h-3.5 w-3.5" aria-hidden="true" />
                    }
                    label="Knowledge base"
                >
                    {artifactCount}{' '}
                    {artifactCount === 1 ? 'artifact' : 'artifacts'}
                </InsightRow>
            )}
        </>
    );
}
