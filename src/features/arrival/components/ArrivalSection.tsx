import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { PanelPresence } from "../../../components/ui/PanelPresence";
import { ArrivalCardPreviewDrawer } from "./ArrivalCardPreviewDrawer";
import { ArrivalStepAuthoring } from "./ArrivalStepAuthoring";
import { useProjectContext } from "../../projects/useProjectContext";
import { useAuth } from "../../../context/useAuth";
import { PermissionGroup } from "../../../services/types";

/**
 * Authoring the arrival list: what a new joiner needs before they can work.
 *
 * The project comes from the app's global project switcher rather than a tab bar of its own —
 * `ArrivalStepAuthoring` shows the company-wide list and, when there is a selected project, that
 * project's additions together, with its own scope switch between the two.
 *
 * HR reads but does not write, matching the backend.
 */
export function ArrivalSection() {
  const { profile } = useAuth();
  const { selectedProjectId, selectedProject } = useProjectContext();
  const projectId = selectedProjectId || null;
  const projectName = selectedProject?.name ?? null;

  const canAuthor =
    profile?.permissionGroup === PermissionGroup.PM ||
    profile?.permissionGroup === PermissionGroup.ADMIN;

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <div>
      <ArrivalStepAuthoring
        readOnly={!canAuthor}
        projectId={projectId}
        projectName={projectName}
        actions={
          <Button
            variant="secondary"
            icon={<Eye className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setIsPreviewOpen(true)}
          >
            Preview card
          </Button>
        }
      />

      {/* Mounted only while open, like the "Pick from issues" sheet on Starter work — the preview
          reads the arrival lists a second time, and that read should not happen before somebody
          actually asks to preview. */}
      <PanelPresence value={isPreviewOpen ? true : null}>
        {() => (
          <ArrivalCardPreviewDrawer
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            projectId={projectId}
            projectName={projectName}
          />
        )}
      </PanelPresence>
    </div>
  );
}
