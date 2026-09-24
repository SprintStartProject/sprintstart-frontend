import { useCallback } from "react";
import { useAuth } from "../../../context/useAuth";
import { useProjectContext } from "../../projects/useProjectContext";
import {
  checklistKey,
  useStoredRecord,
  type AnalysisChecklist,
  type ChecklistItem,
} from "./analysisStorage";
import type { Finding } from "./findings";

/**
 * The checklist a manager kept from an analysis: its findings to act on, each to tick off.
 *
 * Only what asks something of the manager goes on it — "going well" is news, not a task. Keeping a
 * new one replaces the old: a checklist is a snapshot of one run, and two of them for the same
 * project would disagree about what is still open.
 */
export function useAnalysisChecklist() {
  const { profile } = useAuth();
  const { selectedProjectId } = useProjectContext();
  const key = selectedProjectId ? checklistKey(profile?.id ?? "", selectedProjectId) : null;
  const [checklist, write] = useStoredRecord<AnalysisChecklist>(key);

  const keep = useCallback(
    (findings: readonly Finding[], analysedAt: string) => {
      const items: ChecklistItem[] = findings
        .filter((finding) => finding.severity !== "good")
        .map(({ id, title, detail, to, severity, area }) => ({
          id,
          title,
          detail,
          to,
          severity,
          area,
          done: false,
        }));
      write({ analysedAt, items });
    },
    [write],
  );

  const toggle = useCallback(
    (id: string) => {
      if (!checklist) return;
      write({
        ...checklist,
        items: checklist.items.map((item) =>
          item.id === id ? { ...item, done: !item.done } : item,
        ),
      });
    },
    [checklist, write],
  );

  const remove = useCallback(() => write(null), [write]);

  return { checklist, keep, toggle, remove };
}
