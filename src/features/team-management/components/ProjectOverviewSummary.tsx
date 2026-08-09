import { AlertTriangle, Database, Inbox, TrendingUp, Users } from 'lucide-react';
import { STALLED_AFTER_DAYS, type ProjectInsights } from '../useProjectInsights';
import type { AdminProjectDetails } from '../../../services/projectService';

type ProjectOverviewSummaryProps = {
    projects: AdminProjectDetails[];
    insights: Record<string, ProjectInsights>;
};

type Stat = {
    key: string;
    icon: typeof Users;
    value: string;
    label: string;
    /** Draws attention when there is something to act on. */
    isAlert?: boolean;
};

/**
 * The one line a manager reads first: everything that is true across all their
 * projects at once.
 *
 * Only totals, never per-project detail — the widgets below already carry that,
 * and repeating it here would make the page longer rather than faster to scan.
 * Figures whose requests failed are skipped instead of counted as zero, so a
 * missing block can never read as "nothing to do".
 */
export function ProjectOverviewSummary({
    projects,
    insights,
}: ProjectOverviewSummaryProps) {
    const loaded = projects
        .map((project) => insights[project.id])
        .filter((entry): entry is ProjectInsights => Boolean(entry));

    const memberCount = projects.reduce(
        (sum, project) => sum + project.users.length,
        0,
    );

    const attentionLoaded = loaded.filter((entry) => entry.attention !== null);
    const waitingCount = attentionLoaded.reduce(
        (sum, entry) =>
            sum +
            (entry.attention ?? []).filter(
                (item) => item.hasOpenSkipRequest || item.hasUnreadFeedback,
            ).length,
        0,
    );
    const stalledCount = attentionLoaded.reduce(
        (sum, entry) =>
            sum +
            (entry.attention ?? []).filter(
                (item) => item.daysOnCurrentStep > STALLED_AFTER_DAYS,
            ).length,
        0,
    );

    const progressEntries = loaded
        .map((entry) => entry.averageProgress)
        .filter((value): value is number => value !== null);
    const averageProgress =
        progressEntries.length > 0
            ? progressEntries.reduce((sum, value) => sum + value, 0) /
              progressEntries.length
            : null;

    const sourceEntries = loaded.filter((entry) => entry.sources !== null);
    const failedSources = sourceEntries.reduce(
        (sum, entry) =>
            sum +
            (entry.sources ?? []).filter(
                (source) => source.connectionStatus === 'FAILED',
            ).length,
        0,
    );

    const stats: Stat[] = [
        {
            key: 'members',
            icon: Users,
            value: String(memberCount),
            label: memberCount === 1 ? 'member' : 'members',
        },
    ];

    if (attentionLoaded.length > 0) {
        stats.push({
            key: 'waiting',
            icon: Inbox,
            value: String(waitingCount),
            label: 'waiting on you',
            isAlert: waitingCount > 0,
        });
    }

    if (attentionLoaded.length > 0 && stalledCount > 0) {
        stats.push({
            key: 'stalled',
            icon: AlertTriangle,
            value: String(stalledCount),
            label: `over ${STALLED_AFTER_DAYS}d on one step`,
            isAlert: true,
        });
    }

    if (averageProgress !== null) {
        stats.push({
            key: 'progress',
            icon: TrendingUp,
            value: `${Math.round(averageProgress * 100)}%`,
            label: 'average onboarding',
        });
    }

    if (sourceEntries.length > 0 && failedSources > 0) {
        stats.push({
            key: 'sources',
            icon: Database,
            value: String(failedSources),
            label: failedSources === 1 ? 'source failed' : 'sources failed',
            isAlert: true,
        });
    }

    return (
        <section
            aria-label="Across all your projects"
            className="rounded-2xl border border-app-border bg-app-surface px-4 py-3"
        >
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-app-text-muted">
                Across {projects.length}{' '}
                {projects.length === 1 ? 'project' : 'projects'}
            </p>

            <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {stats.map(({ key, icon: Icon, value, label, isAlert }) => (
                    <div key={key} className="flex items-center gap-2">
                        <Icon
                            className={`h-4 w-4 ${
                                isAlert
                                    ? 'text-app-warning-text'
                                    : 'text-app-text-muted'
                            }`}
                            aria-hidden="true"
                        />
                        <dd
                            className={`text-lg font-semibold tabular-nums ${
                                isAlert
                                    ? 'text-app-warning-text'
                                    : 'text-app-text'
                            }`}
                        >
                            {value}
                        </dd>
                        <dt className="text-xs text-app-text-muted">{label}</dt>
                    </div>
                ))}
            </dl>
        </section>
    );
}
