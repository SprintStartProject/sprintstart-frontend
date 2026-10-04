import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "../../../services/queryKeys";
import { onBuddyPathChanged } from "../aiBuddyBus";

/**
 * Marks every cached read of the hire's path stale once the buddy changed it.
 *
 * The pages that fetch the path themselves listen for the signal on their own; this is for the
 * ones that read it through the query cache -- the board, whose path-step cards and progress are
 * part of the board query, and the dashboard's next-step card. Mounted once, at the top of the app,
 * because the dock that confirms the change can sit over any of them.
 */
export function useBuddyPathSync(): void {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      onBuddyPathChanged(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.myStatuses() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.board.all() });
      }),
    [queryClient],
  );
}
