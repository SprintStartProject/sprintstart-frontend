import { useCallback, useRef } from "react";
import { contains } from "../layout/dragGeometry";

/**
 * The boxes a drag is hit-tested against: every card on the board and every area.
 *
 * Registered by the grid rather than looked up in the document, so the grid owns which boxes count
 * as cards and which as areas.
 */
export function useCardRegistry() {
  const cards = useRef(new Map<string, HTMLDivElement>());
  const areas = useRef(new Map<string, HTMLElement>());

  const registerElement = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) cards.current.set(id, element);
    else cards.current.delete(id);
  }, []);

  const registerGroupElement = useCallback((id: string, element: HTMLElement | null) => {
    if (element) areas.current.set(id, element);
    else areas.current.delete(id);
  }, []);

  const elementOf = useCallback((cardId: string) => cards.current.get(cardId), []);
  const areaEntries = useCallback(() => [...areas.current], []);

  /** The card, other than the one being dragged, whose box holds a point. */
  const cardUnder = useCallback(
    (draggedId: string, x: number, y: number): [string, HTMLDivElement] | null => {
      for (const entry of cards.current) {
        if (entry[0] !== draggedId && contains(entry[1], x, y)) return entry;
      }

      return null;
    },
    [],
  );

  /** The card whose box holds a point. */
  const cardIdAt = useCallback((x: number, y: number): string | null => {
    for (const [cardId, element] of cards.current) {
      if (contains(element, x, y)) return cardId;
    }

    return null;
  }, []);

  return {
    registerElement,
    registerGroupElement,
    elementOf,
    cardUnder,
    areaEntries,
    cardIdAt,
  };
}
