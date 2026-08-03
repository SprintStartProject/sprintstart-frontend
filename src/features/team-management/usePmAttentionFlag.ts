import { useEffect, useRef, useState } from "react";
import {
    getTeamOverview,
    onPmAttentionChanged,
} from "../../services/teamManagementService";

/**
 * Shortest gap between two checks triggered by navigation or by returning to
 * the tab.
 *
 * Without this, clicking quickly through the app would fire the request on
 * every single view, and each check costs two calls. Kept short because the
 * flag turning *on* depends on it: the item is created on a team member's
 * device, so this hook cannot learn about it any sooner than its next check.
 *
 * A project switch and a just-handled item always refetch regardless, since the
 * answer demonstrably changed.
 */
export const MIN_REFRESH_INTERVAL_MS = 5_000;

/**
 * Whether the PM Dashboard has anything waiting: a pending skip request, or
 * feedback nobody has read yet.
 *
 * Deliberately a boolean and not a count. The sidebar only needs to say "there
 * is something", and a count would have to stay accurate to be trustworthy.
 *
 * Both signals come from the team overview: `currentStep.skip` carries the skip
 * request, and the service already folds unread feedback into `hasFeedback`.
 * There is no lighter endpoint for either.
 *
 * @param refreshKey Changing this asks for a recheck -- the caller passes the
 * current route, so switching views refreshes the flag. Rate-limited by
 * {@link MIN_REFRESH_INTERVAL_MS}.
 */
export function usePmAttentionFlag(
    projectId: string | null | undefined,
    enabled: boolean,
    refreshKey?: string,
): boolean {
    const [hasAttentionItems, setHasAttentionItems] = useState(false);
    // Bumped when the user acts on the very thing the badge points at, so the
    // recheck is immediate rather than waiting for the rate limit to lapse.
    const [changeNonce, setChangeNonce] = useState(0);
    // Bumped on tab focus. Unlike `changeNonce` this only *asks* for a check
    // and still respects the rate limit, since nothing is known to have changed.
    const [revalidateNonce, setRevalidateNonce] = useState(0);
    const lastFetch = useRef<{ projectId: string | null; nonce: number; at: number }>({
        projectId: null,
        nonce: -1,
        at: 0,
    });
    const isActive = Boolean(enabled && projectId);

    useEffect(
        () =>
            onPmAttentionChanged(() => {
                setChangeNonce((current) => current + 1);
            }),
        [],
    );

    // Coming back to the tab is the strongest hint that time has passed and the
    // answer may be stale. Costs nothing while the tab sits in the background,
    // unlike a timer, and covers the common "I was in Slack for ten minutes"
    // case that navigation alone never catches.
    useEffect(() => {
        if (!isActive) return;

        const recheck = () => {
            if (document.visibilityState === "visible") {
                setRevalidateNonce((current) => current + 1);
            }
        };

        window.addEventListener("focus", recheck);
        document.addEventListener("visibilitychange", recheck);

        return () => {
            window.removeEventListener("focus", recheck);
            document.removeEventListener("visibilitychange", recheck);
        };
    }, [isActive]);

    useEffect(() => {
        if (!isActive || !projectId) return;

        const previous = lastFetch.current;
        // A project switch or a just-handled item is a real change of answer,
        // so neither waits for the rate limit.
        const isForced =
            previous.projectId !== projectId || previous.nonce !== changeNonce;

        if (!isForced && Date.now() - previous.at < MIN_REFRESH_INTERVAL_MS) {
            return;
        }

        // Claim the slot up front so two effects cannot race into the same
        // request, but remember what to restore if this one never lands.
        const releasedSlot = previous;
        lastFetch.current = { projectId, nonce: changeNonce, at: Date.now() };

        let active = true;
        let applied = false;

        const run = async () => {
            try {
                const users = await getTeamOverview(undefined, undefined, [projectId]);
                if (!active) return;

                applied = true;
                setHasAttentionItems(
                    users.some(
                        (user) =>
                            user.hasFeedback ||
                            user.currentStep?.skip?.status === "PENDING",
                    ),
                );
            } catch {
                // A badge is not worth surfacing an error for -- staying quiet
                // is better than claiming there is nothing to do.
                if (!active) return;
                applied = true;
                setHasAttentionItems(false);
            }
        };

        void run();

        return () => {
            active = false;

            // Hand the slot back when this effect is torn down before its
            // result applied. Without this, React StrictMode's double-invoke
            // discards the first request and then finds the second one rate
            // limited, so the flag never arrives at all -- and the same happens
            // in production whenever a view changes mid-request.
            if (!applied) {
                lastFetch.current = releasedSlot;
            }
        };
    }, [projectId, isActive, refreshKey, changeNonce, revalidateNonce]);

    // Gated on read rather than reset in the effect: a member who cannot open
    // the dashboard, or a session with no project selected, must never show the
    // marker, and this keeps that rule out of the async path entirely.
    return isActive && hasAttentionItems;
}
