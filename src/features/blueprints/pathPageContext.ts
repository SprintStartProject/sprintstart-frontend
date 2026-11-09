import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { BlueprintScope } from "../../services/blueprintService.ts";
import type { BlueprintPath } from "./types.ts";

/** What the path page's hooks need to know about where they are and how to reload. */
export interface PathPageContext {
  path: BlueprintPath | null;
  setPath: Dispatch<SetStateAction<BlueprintPath | null>>;
  pathId: string | undefined;
  scope: BlueprintScope;
  isGlobal: boolean;
  listPath: string;
  navigate: NavigateFunction;
  loadPath: (showLoading?: boolean) => Promise<void>;
  setPageError: (message: string | null) => void;
}

/** The address of one version of a blueprint, keeping the global scope when that is where we are. */
export function blueprintAddress(id: string, isGlobal: boolean): string {
  return `/blueprints/${id}${isGlobal ? "?scope=global" : ""}`;
}
