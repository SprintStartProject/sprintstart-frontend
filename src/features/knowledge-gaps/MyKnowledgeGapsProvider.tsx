import { useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../context/useAuth";
import { useFetch } from "../../hooks/useFetch";
import { knowledgeGapService } from "../../services/knowledgeGapService";
import { useProjectContext } from "../projects/useProjectContext";
import { MyKnowledgeGapsContext, type MyKnowledgeGapsValue } from "./MyKnowledgeGapsContext";
import { readSeenComponents, storeSeenComponents } from "./ownerAnnouncement";

/**
 * Fetches "what is assigned to me" once for the whole app, and remembers what has been
 * acknowledged.
 *
 * Sits above the router so the owner dialog can appear wherever the user happens to be, and so
 * the sidebar and the dashboard's default layout can ask the same question without a second
 * request. `MyKnowledgeGapsWidget` still reads the endpoint itself: it is placed and removed by
 * the user and carries its own loading and failure states, and rewiring it here would buy one
 * request at the cost of the widget no longer standing on its own.
 *
 * Nothing is requested until there is a signed-in user *and* a selected project — the endpoint
 * is scoped to a project and answers `400` without one, which is not a failure worth showing.
 */
export function MyKnowledgeGapsProvider({ children }: { children: ReactNode }) {
  const { status, profile } = useAuth();
  const { selectedProjectId } = useProjectContext();

  const userId = profile?.id ?? "";
  const canAsk = status === "authenticated" && selectedProjectId !== "";

  const { data, loading, error } = useFetch(
    () =>
      canAsk
        ? knowledgeGapService.fetchMyKnowledgeGaps(selectedProjectId)
        : Promise.resolve({ gaps: [] }),
    [canAsk, selectedProjectId],
  );

  /*
    Read through from storage until this session acknowledges something, then the state is the
    truth and storage is write-only — the same shape `useDashboardLayout` uses for the board,
    and for the same reason: a preference that lives in the browser has no other way to notice
    that the user in front of it has changed. Keyed by user so a sign-out cannot leave one
    person's acknowledgements standing in for another's.
  */
  const [acknowledged, setAcknowledged] = useState<{
    userId: string;
    components: Set<string>;
  } | null>(null);

  const seen =
    acknowledged?.userId === userId ? acknowledged.components : readSeenComponents(userId);

  const gaps = useMemo(
    () => (data?.gaps ?? []).filter((gap) => gap.severity !== "covered"),
    [data],
  );

  const value = useMemo<MyKnowledgeGapsValue>(() => {
    const components = gaps.map((gap) => gap.component);

    return {
      gaps,
      unseenComponents: components.filter((component) => !seen.has(component)),
      markAllSeen: () => {
        storeSeenComponents(userId, components);
        setAcknowledged({ userId, components: new Set(components) });
      },
      isLoading: canAsk && loading,
      hasFailed: error,
    };
  }, [gaps, seen, userId, loading, error, canAsk]);

  return (
    <MyKnowledgeGapsContext.Provider value={value}>{children}</MyKnowledgeGapsContext.Provider>
  );
}
