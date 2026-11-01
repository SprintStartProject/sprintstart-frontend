import { useCallback, useEffect, useRef, useState } from "react";
import { groupOf, type BoardGroup } from "../layout/boardGroups";

/** What piling onto the lit card does to the dragged card's area, if anything. */
export type PileAreaMove = "into" | "out" | null;

/**
 * The card a dragged one would be piled under if let go now, and the wait before it lights up.
 *
 * The wait is a timer rather than the drag events themselves: those only arrive while the pointer
 * moves, so counting on them alone left a hire who stopped and waited with nothing happening.
 */
export function usePileTarget(groups: BoardGroup[]) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const targetRef = useRef<string | null>(null);
  /** Whether piling onto the lit card moves the dragged one into or out of an area — on the label. */
  const [areaMove, setAreaMove] = useState<PileAreaMove>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const clear = useCallback(() => {
    cancelTimer();
    if (targetRef.current) {
      targetRef.current = null;
      setTargetId(null);
    }
  }, [cancelTimer]);

  const light = useCallback(
    (draggedId: string, candidateId: string) => {
      if (targetRef.current === candidateId) return;
      targetRef.current = candidateId;
      setTargetId(candidateId);
      const from = groupOf(groups, draggedId)?.id ?? null;
      const to = groupOf(groups, candidateId)?.id ?? null;
      setAreaMove(from === to ? null : to ? "into" : "out");
    },
    [groups],
  );

  const schedule = useCallback(
    (ms: number, run: () => void) => {
      cancelTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        run();
      }, ms);
    },
    [cancelTimer],
  );

  useEffect(() => clear, [clear]);

  const isLit = useCallback((id: string) => targetRef.current === id, []);
  const lit = useCallback(() => targetRef.current, []);

  return { targetId, areaMove, clear, light, schedule, cancelTimer, isLit, lit };
}
