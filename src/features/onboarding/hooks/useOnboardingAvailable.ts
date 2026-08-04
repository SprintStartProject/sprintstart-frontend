import { useEffect, useState } from "react";
import { isOnboardingAccessible } from "../../../auth/accessPolicy";
import { knowledgeService } from "../../../services/knowledgeService";
import { useAuth } from "../../../context/useAuth";
import { useProjectContext } from "../../projects/useProjectContext";

/**
 * Whether the onboarding entry should be offered to this user.
 *
 * The backend only builds a path when two things are true: the user holds a
 * project role, and the project has something ingested for the path to be built
 * from. The first is on the profile and is checked synchronously by
 * `isOnboardingAccessible`; the second needs asking.
 *
 * **Fails open.** While the answer is still unknown — in flight, no project
 * selected, or the request failed — the entry stays visible. The two mistakes
 * are not equal: showing a link that leads to an empty page is a small
 * annoyance, whereas hiding navigation because an API blipped looks like the
 * feature was taken away. Only a confirmed-empty project hides it.
 *
 * Not used by `AuthGuard` on purpose. That guard decides access, and gating a
 * route on a network round-trip would put a spinner in front of every
 * navigation to answer a question about content rather than permission. Someone
 * who reaches `/onboarding` by URL still gets the page, which reports its own
 * state.
 */
export function useOnboardingAvailable(): boolean {
    const { profile } = useAuth();
    const { selectedProjectId } = useProjectContext();

    const [isProjectEmpty, setIsProjectEmpty] = useState(false);

    useEffect(() => {
        if (!selectedProjectId || !isOnboardingAccessible(profile)) {
            return;
        }

        let cancelled = false;

        async function check(projectId: string) {
            try {
                const hasContent = await knowledgeService.hasIngestedContent(projectId);
                if (!cancelled) setIsProjectEmpty(!hasContent);
            } catch (error) {
                // Unknown, not empty: leave the entry where it is.
                console.warn("Failed to check ingested content", error);
                if (!cancelled) setIsProjectEmpty(false);
            }
        }

        void check(selectedProjectId);

        return () => {
            cancelled = true;
        };
    }, [selectedProjectId, profile]);

    return isOnboardingAccessible(profile) && !isProjectEmpty;
}
