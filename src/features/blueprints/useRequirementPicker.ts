import { useState } from "react";
import { blueprintService } from "../../services/blueprintService.ts";
import type { RequirementCatalog, RequirementTarget, RequirementType } from "./pathEditorTypes.ts";

/** The add-requirements overlay's own state: which phase, which kind, what is ticked, what exists. */
export function useRequirementPicker() {
  const [target, setTarget] = useState<RequirementTarget>(null);
  const [type, setType] = useState<RequirementType>("SKILL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<RequirementCatalog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Opens the overlay and loads its current skill/role choices on demand. */
  async function open(phaseId: string) {
    setTarget({ phaseId });
    setType("SKILL");
    setSelectedIds([]);
    setIsLoading(true);
    setError(null);
    try {
      setCatalog(await blueprintService.getRequirementCatalog());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Requirement choices could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function close() {
    setTarget(null);
    setError(null);
  }

  function changeType(next: RequirementType) {
    setType(next);
    setSelectedIds([]);
  }

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id],
    );
  }

  return {
    target,
    type,
    selectedIds,
    catalog,
    isLoading,
    error,
    setError,
    open,
    close,
    changeType,
    toggle,
  };
}

export type RequirementPicker = ReturnType<typeof useRequirementPicker>;
