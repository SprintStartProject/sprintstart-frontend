import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { queryKeys } from "../../../services/queryKeys";
import type { KnowledgeRequest } from "../../knowledge-request/types";

export type PmReplies = {
  /** Questions the PM has answered, with the answer itself. */
  answered: KnowledgeRequest[];
  /** Still sitting with a person. */
  waiting: KnowledgeRequest[];
  /** Closed without a reply — shown rather than dropped, see `BuddyPmReplies`. */
  dismissed: KnowledgeRequest[];
  /** Whether there is anything at all to show. Drives whether the page offers the rail. */
  hasAny: boolean;
};

/**
 * What the hire has sent to a person, grouped by what became of it.
 *
 * Lives in a hook rather than inside `BuddyPmReplies` because two things need it and neither
 * should fetch twice: the rail renders it, and the page decides from `hasAny` whether to offer
 * the rail at all. A toggle that opens an empty panel is worse than no toggle. Backed by the
 * shared query cache, that "fetch once" now holds across mounts as well.
 *
 * Loading and failure both come back as "nothing", deliberately. This is a record of something
 * that already happened, so a spinner would make the page jump and an error banner would be
 * noise the hire cannot act on — and the next mount retries anyway.
 *
 * Scoped to the hire, not to the selected project: these are their own questions, and hiding the
 * ones asked on another project would mean an answer silently never arriving.
 */
export function usePmReplies(): PmReplies {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.knowledgeRequest.mine(),
    queryFn: () => knowledgeRequestService.listMine(),
  });

  return useMemo(() => {
    const requests = isLoading || isError ? [] : (data ?? []);
    const answered = requests.filter((r) => r.status === "ANSWERED" && r.answer !== null);
    const waiting = requests.filter((r) => r.status === "OPEN");
    const dismissed = requests.filter((r) => r.status === "DISMISSED");

    return {
      answered,
      waiting,
      dismissed,
      hasAny: answered.length + waiting.length + dismissed.length > 0,
    };
  }, [data, isLoading, isError]);
}
