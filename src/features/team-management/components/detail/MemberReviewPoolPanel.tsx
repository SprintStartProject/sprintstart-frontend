// ============================================================
// MemberReviewPoolPanel.tsx
// ============================================================
// Shows the questions a member still has to answer correctly.
// Relevant for PMs because the review pool is the second gate
// for counting as onboarded: passing the final phase check is
// not enough while anything is still open here.
// ============================================================

import { useState, useEffect } from 'react';
import { onboardingService } from '../../../../services/onboardingService';
import type { ReviewCheckEndpoint } from '../../../onboarding/types';
import { Loader2, AlertCircle, CheckCircle2, ChevronDown, RotateCcw } from 'lucide-react';

type MemberReviewPoolPanelProps = {
    userId: string;
};

export function MemberReviewPoolPanel({ userId }: MemberReviewPoolPanelProps) {
    const [pool, setPool] = useState<ReviewCheckEndpoint | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const load = async () => {
            setPool(null);
            setLoadError(null);
            setExpanded(false);
            try {
                setPool(await onboardingService.fetchUserReviewCheck(userId));
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : 'Unknown error');
            }
        };
        void load();
    }, [userId]);

    return (
        <div className="rounded-3xl border border-app-border bg-app-surface p-6">
            <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-app-brand" />
                <h2 className="text-lg font-semibold text-app-text">Review questions</h2>
            </div>
            <p className="mt-1 text-sm text-app-text-muted">
                Questions missed in earlier phases. They have to be answered correctly before
                the onboarding counts as finished.
            </p>

            {!pool && !loadError && (
                <div className="mt-4 flex items-center gap-2 text-sm text-app-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-app-brand" />
                    Loading...
                </div>
            )}

            {loadError && (
                <p className="mt-4 flex items-center gap-2 text-sm text-app-danger-solid">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {loadError}
                </p>
            )}

            {pool && pool.openCount === 0 && (
                <p className="mt-4 flex items-center gap-2 text-sm text-app-success-text">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Nothing open — every question answered correctly so far.
                </p>
            )}

            {pool && pool.openCount > 0 && (
                <>
                    {/* Collapsed by default: the count is the answer to "is this member
                        blocked?", the question list is only needed when digging in. */}
                    <button
                        type="button"
                        onClick={() => setExpanded((current) => !current)}
                        aria-expanded={expanded}
                        aria-controls="member-review-pool-questions"
                        className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-app-warning-border bg-app-warning-bg px-3 py-2.5 text-left transition-all hover:border-app-warning-solid"
                    >
                        <span className="text-sm font-semibold text-app-warning-text">
                            {pool.openCount} open{' '}
                            {pool.openCount === 1 ? 'question' : 'questions'}
                        </span>
                        <ChevronDown
                            className={`h-4 w-4 shrink-0 text-app-warning-text transition-transform ${
                                expanded ? 'rotate-180' : ''
                            }`}
                        />
                    </button>

                    {expanded && (
                        <ul id="member-review-pool-questions" className="mt-3 space-y-2">
                            {pool.questions.map((question) => (
                                <li
                                    key={question.id}
                                    className="rounded-2xl border border-app-border bg-app-surface-muted px-3 py-2"
                                >
                                    <p className="text-sm text-app-text">{question.question}</p>
                                    {question.reviewSourcePhaseTitle && (
                                        <p className="mt-0.5 text-xs text-app-text-muted">
                                            from {question.reviewSourcePhaseTitle}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}
