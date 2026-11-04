import { AlertTriangle, ShieldCheck, Database, Users } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { SaveButton } from "../../../../components/ui/SaveButton";
import { getManagerName } from "../../data";
import type { AdminProjectDetails, ProjectOverview } from "../../types";
import { AccessBadge } from "../Badges";
import { memberBadgeLabel, sourceBadgeLabel, unsavedChangesLabel } from "./drawerRules";
import type { Derived } from "./drawerRules";
import type { useDrawerActions } from "./useDrawerActions";

/** Members, sources and manager in the header, so the body never repeats them as tiles. */
export function DrawerBadges({
  project,
  memberCount,
  sourceCount,
}: {
  project: ProjectOverview | AdminProjectDetails;
  memberCount: number;
  sourceCount: number;
}) {
  return (
    <>
      <AccessBadge variant="neutral">
        <Users className="mr-1 h-3 w-3" aria-hidden="true" />
        {memberBadgeLabel(memberCount)}
      </AccessBadge>
      <AccessBadge variant={sourceCount > 0 ? "success" : "neutral"}>
        <Database className="mr-1 h-3 w-3" aria-hidden="true" />
        {sourceBadgeLabel(sourceCount)}
      </AccessBadge>
      {project.manager ? (
        <AccessBadge variant="brand">
          <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
          {`Manager: ${getManagerName(project.manager)}`}
        </AccessBadge>
      ) : (
        <AccessBadge variant="danger">
          <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
          No manager
        </AccessBadge>
      )}
    </>
  );
}

/** The one save affordance: how many changes are staged, and discard or apply them together. */
export function UnsavedFooter({
  derived,
  actions,
}: {
  derived: Derived;
  actions: Pick<ReturnType<typeof useDrawerActions>, "isSaving" | "discardChanges" | "requestSave">;
}) {
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-app-text">
        {unsavedChangesLabel(derived.pendingChangeCount)}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
        <Button variant="secondary" onClick={actions.discardChanges} disabled={actions.isSaving}>
          Discard
        </Button>

        <SaveButton dirty saving={actions.isSaving} onClick={actions.requestSave} />
      </div>
    </div>
  );
}
