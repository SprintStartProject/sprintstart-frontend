import { useEffect, useRef, useState } from "react";
import { useToast } from "../../context/useToast";
import { onboardingService } from "../../services/onboardingService";
import { describeRebuildError } from "./memberRules";
import type { MemberData } from "./useMemberData";

/**
 * Rebuilding a member's path is the PM's call alone (members can only build their first one), so
 * the control lives on this page rather than on the member's onboarding page.
 *
 * Leaving the page only stops watching; the generation carries on on the backend.
 */
export function usePathRebuild(data: MemberData, selectedProjectId: string) {
  const toast = useToast();
  const { user, isShown, refreshMember, refreshOnboardingPath } = data;
  const [confirming, setConfirming] = useState(false);
  const [rebuildingUserId, setRebuildingUserId] = useState<string | null>(null);
  const watch = useRef<AbortController | null>(null);
  useEffect(() => () => watch.current?.abort(), []);

  function start() {
    if (!user || !selectedProjectId || rebuildingUserId) return;
    const memberId = user.userId;
    const firstName = user.firstname;
    const controller = new AbortController();
    watch.current?.abort();
    watch.current = controller;
    setConfirming(false);
    setRebuildingUserId(memberId);
    toast.info(`Rebuilding ${firstName}'s onboarding path`, {
      description: "This runs in the background and takes a few minutes.",
    });

    const finish = () => {
      if (watch.current === controller) watch.current = null;
      setRebuildingUserId((current) => (current === memberId ? null : current));
    };

    void onboardingService
      .rebuildMemberPath(
        selectedProjectId,
        memberId,
        {
          onPath: () => {},
          onDone: () => {
            finish();
            if (!isShown(memberId)) return;
            toast.success(`${firstName}'s onboarding path was rebuilt`);
            void Promise.all([refreshOnboardingPath(), refreshMember()]);
          },
          onError: (message, reason) => {
            finish();
            toast.error(`${firstName}'s path could not be rebuilt`, {
              description: describeRebuildError(message, reason),
            });
          },
          onInterrupted: () => {
            finish();
            toast.info("Lost track of the rebuild", {
              description: "It keeps running on the server. Reload the page in a few minutes.",
            });
          },
        },
        controller.signal,
      )
      .catch((error: unknown) => {
        finish();
        if (controller.signal.aborted) return;
        toast.error(`${firstName}'s path could not be rebuilt`, {
          description: error instanceof Error ? error.message : undefined,
        });
      });
  }

  return { confirming, setConfirming, rebuildingUserId, start };
}
