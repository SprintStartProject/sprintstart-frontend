import { useCallback, useEffect, useState } from 'react';
import { getTeamOverview } from '../../services/teamManagementService';
import {
    getIngestionSourceStatuses,
    getProjectArtifacts,
} from '../../services/ingestionService';
import type { SourceInstanceIngestionStatus } from '../data-ingestion/types';
import type { TeamOverviewUser } from './types';

/** A member who needs the manager to do something. */
export type AttentionItem = {
    userId: string;
    /** Their onboarding step is waiting for a skip decision. */
    hasOpenSkipRequest: boolean;
    /** They left feedback nobody has read. */
    hasUnreadFeedback: boolean;
    /** Days on the current step, for the stalled count. */
    daysOnCurrentStep: number;
};

/** Everything the project card shows beyond its members and sources. */
export type ProjectInsights = {
    /** `null` when the request failed — the block is then left out entirely. */
    sources: SourceInstanceIngestionStatus[] | null;
    attention: AttentionItem[] | null;
    averageProgress: number | null;
    artifactCount: number | null;
};

/**
 * A member counts as stalled after this long on the same step.
 *
 * Same threshold `TeamMemberCard` uses for its at-risk marker, so the card and
 * the project summary never disagree about who is stuck.
 */
export const STALLED_AFTER_DAYS = 5;

const EMPTY_INSIGHTS: ProjectInsights = {
    sources: null,
    attention: null,
    averageProgress: null,
    artifactCount: null,
};

function getDaysOnCurrentStep(user: TeamOverviewUser): number {
    if (!user.currentStep?.startedAt) return 0;

    const started = new Date(user.currentStep.startedAt).getTime();

    return Math.max(
        0,
        Math.floor((Date.now() - started) / (1000 * 60 * 60 * 24)),
    );
}

function toAttentionItems(users: TeamOverviewUser[]): AttentionItem[] {
    return users
        .map((user) => ({
            userId: user.userId,
            hasOpenSkipRequest: user.currentStep?.skip?.status === 'PENDING',
            hasUnreadFeedback: user.hasFeedback,
            daysOnCurrentStep: getDaysOnCurrentStep(user),
        }))
        .filter(
            (item) =>
                item.hasOpenSkipRequest ||
                item.hasUnreadFeedback ||
                item.daysOnCurrentStep > STALLED_AFTER_DAYS,
        );
}

/**
 * Loads the extra project figures shown on the Project Management cards.
 *
 * Every source is fetched independently and failures collapse to `null` rather
 * than rejecting the whole hook: a project whose ingestion endpoint is down
 * should still show its members and its open requests. The blocks that got no
 * data simply do not render.
 *
 * The team overview doubles as the progress and the attention source — it is
 * the only endpoint carrying both `hasFeedback` and the pending skip request,
 * so asking for it twice would buy nothing.
 *
 * @param projectIds Projects to load, as a comma-joined string so a new array
 * with the same ids does not retrigger the effect.
 */
export function useProjectInsights(
    projectIds: string,
): Record<string, ProjectInsights> {
    const [insights, setInsights] = useState<Record<string, ProjectInsights>>(
        {},
    );

    const load = useCallback(async (projectId: string) => {
        const [sources, users, artifacts] = await Promise.all([
            getIngestionSourceStatuses(projectId).catch(() => null),
            getTeamOverview(undefined, undefined, [projectId]).catch(
                () => null,
            ),
            getProjectArtifacts(projectId, { page: 1, size: 1 })
                .then((page) => page.page.totalElements)
                .catch(() => null),
        ]);

        const result: ProjectInsights = {
            sources,
            attention: users ? toAttentionItems(users) : null,
            averageProgress:
                users && users.length > 0
                    ? users.reduce(
                          (sum, user) => sum + user.progressPercentage,
                          0,
                      ) / users.length
                    : null,
            artifactCount: artifacts,
        };

        return { projectId, result };
    }, []);

    useEffect(() => {
        const ids = projectIds.split(',').filter(Boolean);
        if (ids.length === 0) return;

        let active = true;

        void Promise.all(ids.map(load)).then((entries) => {
            if (!active) return;

            setInsights(
                Object.fromEntries(
                    entries.map(({ projectId, result }) => [projectId, result]),
                ),
            );
        });

        return () => {
            active = false;
        };
    }, [load, projectIds]);

    return insights;
}

export { EMPTY_INSIGHTS };
