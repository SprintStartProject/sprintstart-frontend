import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { offboardingService } from "../../services/offboardingService";
import type { AliasLink } from "../../services/offboardingTypes";
import { queryKeys } from "../../services/queryKeys";

/** Confirming or taking back a link between two identities; the member list is refreshed after each. */
export function useIdentityLinks(projectId: string) {
  const queryClient = useQueryClient();
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.offboarding.members(projectId) }),
    [projectId, queryClient],
  );

  const link = useCallback(
    async (confirmed: AliasLink) => {
      await offboardingService.linkIdentities(projectId, confirmed);
      await refresh();
    },
    [projectId, refresh],
  );

  const unlink = useCallback(
    async (alias: string) => {
      await offboardingService.unlinkIdentity(projectId, alias);
      await refresh();
    },
    [projectId, refresh],
  );

  return { link, unlink };
}
