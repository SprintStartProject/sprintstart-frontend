import { useEffect, useState, type RefObject } from "react";
import type { JourneyCameraHandle } from "../../../graph/JourneyCanvas";

type DivesInput = {
  mapCamera: RefObject<JourneyCameraHandle | null>;
  phaseCamera: RefObject<JourneyCameraHandle | null>;
  openPhaseId: string | null;
  openItemId: string | null;
  onOpenPhaseChange: (phaseId: string | null) => void;
  onOpenItemChange?: (itemId: string | null) => void;
  onSelectItem: (id: string | null) => void;
  setArranging: (arranging: boolean) => void;
};

type Dives = {
  divingInto: string | null;
  surfacedFrom: string | null;
  divingIntoItem: string | null;
  dive: (phaseId: string) => Promise<void>;
  surface: () => void;
  enterItem: (itemId: string) => Promise<void>;
  leaveItem: () => void;
};

/**
 * Flying the camera into a phase or an item and back out. The fly-in finishes before the view
 * changes, so the node being entered is the one that opens up; the fly-out only starts from a phase
 * once, and a later visit to the map opens on the whole map.
 */
export function useCameraDives(input: DivesInput): Dives {
  const { mapCamera, phaseCamera, openItemId, onOpenItemChange } = input;
  const [divingInto, setDivingInto] = useState<string | null>(null);
  const [surfacedFrom, setSurfacedFrom] = useState<string | null>(null);
  const [divingIntoItem, setDivingIntoItem] = useState<string | null>(null);

  useEffect(() => {
    if (!surfacedFrom) return;
    const timer = window.setTimeout(() => setSurfacedFrom(null), 900);
    return () => window.clearTimeout(timer);
  }, [surfacedFrom]);

  const enterItem = async (itemId: string) => {
    if (!onOpenItemChange || divingIntoItem) return;
    setDivingIntoItem(itemId);
    await phaseCamera.current?.zoomIntoNode(itemId, 380);
    setDivingIntoItem(null);
    onOpenItemChange(itemId);
  };

  const leaveItem = () => {
    onOpenItemChange?.(null);
    void phaseCamera.current?.flyToFit();
  };

  // Escape steps back out of an item, unless it is being typed into.
  useEffect(() => {
    if (!openItemId || !onOpenItemChange) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "Escape" || target?.closest('input, textarea, select, [role="dialog"]')) {
        return;
      }
      onOpenItemChange(null);
      void phaseCamera.current?.flyToFit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenItemChange, openItemId, phaseCamera]);

  const dive = async (phaseId: string) => {
    if (divingInto) return;
    setDivingInto(phaseId);
    await mapCamera.current?.zoomIntoNode(phaseId);
    setDivingInto(null);
    input.setArranging(false);
    input.onSelectItem(null);
    input.onOpenPhaseChange(phaseId);
  };

  const surface = () => {
    onOpenItemChange?.(null);
    setSurfacedFrom(input.openPhaseId);
    input.setArranging(false);
    input.onSelectItem(null);
    input.onOpenPhaseChange(null);
  };

  return { divingInto, surfacedFrom, divingIntoItem, dive, surface, enterItem, leaveItem };
}
