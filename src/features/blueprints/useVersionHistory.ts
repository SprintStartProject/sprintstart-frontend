import { useState } from "react";
import { blueprintService } from "../../services/blueprintService.ts";
import type { PathPageContext } from "./pathPageContext.ts";
import type { BlueprintPath } from "./types.ts";

/** The version-history overlay: whether it is open, and the versions it lists. */
export function useVersionHistory(context: PathPageContext) {
  const { path, scope } = context;
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<BlueprintPath[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function open() {
    if (!path) return;
    setIsOpen(true);
    setIsLoading(true);
    try {
      setVersions(await blueprintService.getHistory(scope, path.blueprintKey));
    } catch (reason) {
      context.setPageError(
        reason instanceof Error ? reason.message : "Blueprint history could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function close() {
    setIsOpen(false);
  }

  function drop(versionId: string) {
    setVersions((current) => current.filter((item) => item.id !== versionId));
  }

  return { isOpen, versions, isLoading, open, close, drop };
}

export type VersionHistory = ReturnType<typeof useVersionHistory>;
