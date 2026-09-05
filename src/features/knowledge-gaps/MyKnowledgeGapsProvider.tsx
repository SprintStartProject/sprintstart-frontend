import { useMemo, type ReactNode } from "react";
import { useAuth } from "../../context/useAuth";
import { useFetch } from "../../hooks/useFetch";
import { knowledgeGapService } from "../../services/knowledgeGapService";
import { useProjectContext } from "../projects/useProjectContext";
import { MyKnowledgeGapsContext, type MyKnowledgeGapsValue } from "./MyKnowledgeGapsContext";

/**
 * Fetches "what is assigned to me" once for the whole app.
 *
 * Sits above the router so the owner announcement can appear wherever the user happens to be,
 * and so the dashboard's default layout can ask the same question without a second request.
 * `MyKnowledgeGapsWidget` still reads the endpoint itself: it is placed and removed by the
 * user and carries its own loading and failure states, and rewiring it here would buy one
 * request at the cost of the widget no longer standing on its own.
 *
 * Nothing is requested until there is a signed-in user *and* a selected project — the endpoint
 * is scoped to a project and answers `400` without one, which is not a failure worth showing.
 */
export function MyKnowledgeGapsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { selectedProjectId } = useProjectContext();

  const canAsk = status === "authenticated" && selectedProjectId !== "";

  const { data, loading, error } = useFetch(
    () =>
      canAsk
        ? knowledgeGapService.fetchMyKnowledgeGaps(selectedProjectId)
        : Promise.resolve({ gaps: [] }),
    [canAsk, selectedProjectId],
  );

  const value = useMemo<MyKnowledgeGapsValue>(
    () => ({
      gaps: (data?.gaps ?? []).filter((gap) => gap.severity !== "covered"),
      isLoading: canAsk && loading,
      hasFailed: error,
    }),
    [data, loading, error, canAsk],
  );

  return (
    <MyKnowledgeGapsContext.Provider value={value}>{children}</MyKnowledgeGapsContext.Provider>
  );
}
