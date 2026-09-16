import { PlaneLanding } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
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

  const canAuthor =
    profile?.permissionGroup === PermissionGroup.PM ||
    profile?.permissionGroup === PermissionGroup.ADMIN;

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={PlaneLanding}
            title="Arrival"
            subtitle="What somebody needs before they can start. Raised by their buddy on their board, never enforced."
          />
        </div>
      </header>

      <main className="app-page-frame space-y-5 py-6 lg:py-8">
        <ArrivalStepAuthoring
          readOnly={!canAuthor}
          projectId={selectedProjectId || null}
          projectName={selectedProject?.name ?? null}
        />
      </main>
    </div>
  );
}
