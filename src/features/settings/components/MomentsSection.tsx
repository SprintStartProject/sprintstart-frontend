import { Rocket } from 'lucide-react';
import { useMoments } from '../../moments';

/**
 * Toggles for small decorative extras that sit outside the onboarding flow —
 * currently just the rocket pet in the corner. Off by default (Aug 2026): a
 * novelty like this should be something people opt into from here, not
 * something everyone has to notice in the corner of every page and dismiss.
 *
 * A single toggle today, but its own section rather than tacked onto
 * Appearance or Chat: more of these are expected to move behind Settings
 * over time, and this is where they should land.
 */
export function MomentsSection() {
    const { showRocketPet, setShowRocketPet } = useMoments();

    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
                <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-app-brand-text" aria-hidden />
                <div className="min-w-0">
                    <p className="text-sm font-medium text-app-text">Rocket pet</p>
                    <p className="mt-1 text-sm text-app-text-subtle">
                        A little rocket that hides in the bottom-right corner of every page
                        and can be launched for fun. Off by default.
                    </p>
                </div>
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={showRocketPet}
                data-testid="rocket-pet-toggle"
                onClick={() => setShowRocketPet(!showRocketPet)}
                className={[
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus',
                    showRocketPet ? 'bg-app-brand' : 'bg-app-border-strong',
                ].join(' ')}
                aria-label="Toggle rocket pet visibility"
            >
                <span
                    className={[
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        showRocketPet ? 'translate-x-6' : 'translate-x-1',
                    ].join(' ')}
                />
            </button>
        </div>
    );
}
