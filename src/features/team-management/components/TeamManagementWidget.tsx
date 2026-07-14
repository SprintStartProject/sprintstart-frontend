// ============================================================
// TeamManagementWidget.tsx
// Dashboard widget — shows the 4 most stuck team members
// (longest time on current step) as cards (same TeamMemberCard
// used on the Team Management page) plus unread counts for
// pending feedback and skip requests.
// Clicking anywhere on the widget navigates to the Team
// Management page; clicking a member card navigates straight to
// that member's detail page.
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, Loader2, AlertCircle, MessageSquareText, SkipForward } from 'lucide-react';
import { getTeamOverview } from '../../../services/teamManagementService';
import { ClickableCard } from '../../../components/common/ClickableCard';
import { TeamMemberCard } from './TeamMemberCard';
import type { TeamOverviewUser } from '../types';

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: badge pill used in the widget header
// ─────────────────────────────────────────────────────────────

type CountBadgeProps = {
    icon: React.ReactNode;
    count: number;
    label: string;
    /** soft = brand-tinted background, muted = neutral */
    variant: 'soft' | 'muted';
};

function CountBadge({ icon, count, label, variant }: CountBadgeProps) {
    const base = 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium';
    const styles =
        variant === 'soft'
            ? `${base} bg-app-brand-soft text-app-brand-text`
            : `${base} bg-app-surface-muted text-app-text-muted`;

    return (
        <span className={styles} title={label}>
            {icon}
            {count}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: TeamManagementWidget
// ─────────────────────────────────────────────────────────────

export function TeamManagementWidget() {
    const [users, setUsers] = useState<TeamOverviewUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getTeamOverview();
                setUsers(data);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    // ── LOADING ──────────────────────────────────────────────

    if (loading) {
        return (
            <div className="rounded-2xl border border-app-border bg-app-surface p-6 flex items-center justify-center min-h-48">
                <Loader2 className="w-5 h-5 animate-spin text-app-brand" />
            </div>
        );
    }

    // ── ERROR ────────────────────────────────────────────────

    if (error || users.length === 0) {
        return (
            <div className="rounded-2xl border border-app-border bg-app-surface p-6 flex flex-col items-center justify-center gap-2 min-h-48 text-center">
                <AlertCircle className="w-5 h-5 text-app-text-muted" />
                <p className="text-sm text-app-text-muted">
                    Could not load team data.
                </p>
            </div>
        );
    }

    // ── DERIVED DATA ─────────────────────────────────────────

    // Sort by longest time on current step (most stuck first), take top 4
    const mostStuck = [...users]
        .sort(
            (a, b) => {
                if (!a.currentStep?.startedAt) return 1;
                if (!b.currentStep?.startedAt) return -1;

                return (
                    new Date(a.currentStep.startedAt).getTime() -
                    new Date(b.currentStep.startedAt).getTime()
                );
            }
        )
        .slice(0, 4);

    // Unread counts across ALL users, not just the visible 4
    const pendingFeedbackCount = users.filter((u) => u.hasFeedback).length;
    const pendingSkipCount = users.filter(
        (u) => u.currentStep?.skip?.status === 'PENDING'
    ).length;

    // ── RENDER ───────────────────────────────────────────────

    return (
        <ClickableCard
            onClick={() => void navigate('/team-management')}
            interactive={false}
            className="rounded-2xl border border-app-border bg-app-surface p-5 cursor-pointer transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover has-[a:hover]:!border-app-border has-[a:hover]:!bg-app-surface"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-app-brand" />
                    <span className="text-sm font-semibold text-app-text">
                        Team progress
                    </span>
                </div>

                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        void navigate('/team-management');
                    }}
                    className="flex items-center gap-1 rounded-lg text-xs text-app-text-muted transition-colors hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                >
                    See all ({users.length})
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Unread count badges — only render the badges that have a count */}
            {(pendingFeedbackCount > 0 || pendingSkipCount > 0) && (
                <div className="flex items-center gap-2 mb-4">
                    {pendingFeedbackCount > 0 && (
                        <CountBadge
                            icon={<MessageSquareText className="w-3 h-3" />}
                            count={pendingFeedbackCount}
                            label={`${pendingFeedbackCount} unread feedback`}
                            variant="soft"
                        />
                    )}
                    {pendingSkipCount > 0 && (
                        <CountBadge
                            icon={<SkipForward className="w-3 h-3" />}
                            count={pendingSkipCount}
                            label={`${pendingSkipCount} open skip request${pendingSkipCount > 1 ? 's' : ''}`}
                            variant="muted"
                        />
                    )}
                </div>
            )}

            {/* Member cards — same TeamMemberCard used on the Team Management page,
                rendered in its compact variant to fit the dashboard widget */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {mostStuck.map((user) => (
                    // Propagation guard only: TeamMemberCard is itself a keyboard-
                    // and mouse-accessible <Link>, this wrapper just stops its click
                    // from also triggering the surrounding card's onClick/onKeyDown.
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                    <div
                        key={user.userId}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <TeamMemberCard user={user} compact />
                    </div>
                ))}
            </div>
        </ClickableCard>
    );
}
