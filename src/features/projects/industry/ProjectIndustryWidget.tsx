import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuth } from "../../../context/useAuth";
import { projectService, type AdminProjectDetails } from "../../../services/projectService";
import { useProjectContext } from "../useProjectContext";
import { ProjectIndustryPanel } from "./ProjectIndustryPanel";

/**
 * PM Dashboard card showing the selected project's detected industry.
 *
 * Loads through the project-scoped endpoint (not the admin-only one used by
 * the admin drawer), so it works for a plain member too — only the
 * re-evaluate button is gated, to the manager or an admin. There is no manual
 * edit here: setting the industry by hand is admin-only (the PATCH endpoint),
 * so a PM can only trigger a fresh AI evaluation.
 */
export function ProjectIndustryWidget() {
  const { profile } = useAuth();
  const { selectedProjectId, selectedProject } = useProjectContext();

  const [project, setProject] = useState<AdminProjectDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedProjectId) {
      // Deferred so the reset is not a synchronous state update inside the
      // effect body, which `react-hooks/set-state-in-effect` rejects.
      void Promise.resolve().then(() => {
        setProject(null);
        setError("");
      });
      return;
    }

    let isMounted = true;

    void projectService
      .getAccessibleProject(selectedProjectId)
      .then((nextProject) => {
        if (!isMounted) return;

        setProject(nextProject);
        setError("");
      })
      .catch((fetchError: unknown) => {
        if (!isMounted) return;

        setProject(null);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Project industry could not be loaded.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  const canEvaluate = profile?.permissionGroup === "ADMIN" || (selectedProject?.isManaged ?? false);

  const handleEvaluated = async () => {
    // Deliberately does not call the project context's `reloadProjects` here:
    // that flips its `isLoading` flag, which `ManagerAreaGuard` uses to swap
    // this whole route for a skeleton — unmounting this widget (and the
    // freshly-evaluated evidence list inside it) right after it renders. The
    // project switcher does not surface industry today, so there is nothing
    // there to keep in sync.
    try {
      const nextProject = await projectService.getAccessibleProject(selectedProjectId);
      setProject(nextProject);
      setError("");
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Project industry could not be loaded.",
      );
    }
  };

  if (!selectedProjectId) return null;

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Tag className="h-4 w-4 text-app-brand" />
        <h2 className="text-sm font-semibold text-app-text">Industry</h2>
      </div>

      {error ? (
        <p className="text-sm text-app-text-muted">{error}</p>
      ) : !project ? (
        <div className="flex items-center justify-center p-4">
          <Spinner size="lg" label="Loading" />
        </div>
      ) : (
        <ProjectIndustryPanel
          projectId={selectedProjectId}
          industry={project.industry}
          industryConfidence={project.industryConfidence}
          industryCustom={project.industryCustom}
          canEvaluate={canEvaluate}
          collapsibleEvidence
          onEvaluated={() => void handleEvaluated()}
        />
      )}
    </div>
  );
}
