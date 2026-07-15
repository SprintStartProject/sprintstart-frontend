import { Link } from 'react-router-dom';
import { MessageSquareText, SkipForward } from 'lucide-react';
import type { TeamOverviewUser } from '../types';

type TeamMemberCardProps = {
    user: TeamOverviewUser;
    /**
     * Renders a denser variant (smaller avatar/text/paddings, role hidden)
     * for tight spaces like the PM Dashboard widget grid, while the default
     * size is used on the full Team Management page.
     */
    compact?: boolean;
};

const AT_RISK_AFTER_DAYS = 5;

function getElapsedDays(startedAt: string): number {
    const started = new Date(startedAt).getTime();

    return Math.max(
        0,
        Math.floor((Date.now() - started) / (1000 * 60 * 60 * 24))
    );
}

import { UserAvatar } from '../../../components/common/UserAvatar';
export function TeamMemberCard({ user, compact = false }: TeamMemberCardProps) {
    const elapsedDays = user.currentStep?.startedAt
        ? getElapsedDays(user.currentStep.startedAt)
        : 0;

    const progressPercentage = Math.round(user.progressPercentage * 100);
    const isAtRisk = !!user.currentStep && elapsedDays > AT_RISK_AFTER_DAYS;

    const hasPendingSkipRequest =
        user.currentStep?.skip?.status === 'PENDING';

    return (
        <Link
            to={`/team/${user.userId}`}
            className={`group relative flex flex-col rounded-2xl border border-app-border bg-app-surface transition-all hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-md ${
                compact ? 'p-2' : 'p-4'
            }`}
        >
            <div
                className={`absolute flex items-center gap-1 ${
                    compact ? 'right-2 top-2' : 'right-3 top-3 gap-1.5'
                }`}
            >
                {user.hasFeedback && (
                    <span
                        title="Unread onboarding feedback"
                        className={`flex items-center justify-center rounded-full border border-app-warning-border bg-app-warning-bg text-app-warning-text shadow-sm ${
                            compact ? 'h-5 w-5' : 'h-6 w-6'
                        }`}
                    >
                        <MessageSquareText className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                    </span>
                )}

                {hasPendingSkipRequest && (
                    <span
                        title="Open skip request"
                        className={`flex items-center justify-center rounded-full border border-app-danger-border bg-app-danger-bg text-app-danger-text shadow-sm ${
                            compact ? 'h-5 w-5' : 'h-6 w-6'
                        }`}
                    >
                        <SkipForward className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                    </span>
                )}
            </div>

            <div className={`flex items-center gap-2 ${compact ? 'pr-7' : 'pr-14 gap-3'}`}>
                <div className="flex shrink-0 items-center justify-center">
                    <UserAvatar profileIcon={user.profileIcon} fallbackName={`${user.firstname} ${user.lastname}`.trim()} seed={user.userId} size={compact ? 26 : 40} />
                </div>

                <div className="min-w-0">
                    <p
                        className={`truncate font-semibold text-app-text ${
                            compact ? 'text-xs' : 'text-sm'
                        }`}
                    >
                        {user.firstname} {user.lastname}
                    </p>
                    {!compact && (
                        <p className="text-sm text-app-text-muted">
                            {user.roles.length > 0
                                ? user.roles.map((role) => role.name).join(', ')
                                : 'No role assigned'}
                        </p>
                    )}
                </div>
            </div>

            <div className={compact ? 'mt-2' : 'mt-3'}>
                <div className="flex items-start justify-between gap-3">
                    <p
                        className={`line-clamp-2 font-medium text-app-text ${
                            compact ? 'text-xs' : 'text-sm'
                        }`}
                    >
                        {user.currentStep?.title ?? 'No current step'}
                    </p>

                    <span
                        className={`shrink-0 text-xs ${
                            isAtRisk
                                ? 'font-medium text-app-warning-text'
                                : 'text-app-text-muted'
                        }`}
                    >
                        {user.currentStep ? `${elapsedDays}d` : '—'}
                    </span>
                </div>

                <div className={`flex items-center gap-2 ${compact ? 'mt-2' : 'mt-3'}`}>
                    <div
                        className={`flex-1 overflow-hidden rounded-full bg-app-progress-track ${
                            compact ? 'h-1' : 'h-1.5'
                        }`}
                    >
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end transition-all duration-500"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>

                    <span
                        className={`font-medium tabular-nums text-app-text ${
                            compact ? 'text-[10px]' : 'text-xs'
                        }`}
                    >
                        {progressPercentage}%
                    </span>
                </div>
            </div>
        </Link>
    );
}
