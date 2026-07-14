import { BriefcaseBusiness } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../context/useAuth";
import { IngestionStatusWidget } from "../features/data-ingestion/components/IngestionStatusWidget";
import { FaqWidget } from "../features/faq/components/FaqWidget";
import { KnowledgeGapWidget } from "../features/knowledge-gaps/components/KnowledgeGapWidget";
import { ProjectSelect } from "../features/projects/components/ProjectSelect";
import { useProjectSelection } from "../features/projects/useProjectSelection";
import { TeamManagementWidget } from "../features/team-management/components/TeamManagementWidget";

/**
 * Landing page for PM/HR/Admin users. Surfaces at-a-glance widgets for
 * ingestion health, team onboarding progress, recurring FAQ questions, and
 * knowledge gaps, each linking to its full detail page.
 */
export function PmDashboardPage() {
  const { profile } = useAuth();
  const {
    projects,
    selectedProjectId,
    isLoading: isLoadingProjects,
    errorMessage: projectErrorMessage,
    setSelectedProjectId,
  } = useProjectSelection();

  return (
    <div className="min-h-screen bg-app-bg">
      <header className="border-b border-app-border bg-app-bg">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={BriefcaseBusiness}
            title="PM Dashboard"
            subtitle="Track team onboarding, spot recurring questions and keep knowledge gaps visible."
            actions={
              profile?.permissionGroup === "ADMIN" ? (
                <ProjectSelect
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  isLoading={isLoadingProjects}
                  errorMessage={projectErrorMessage}
                  onChange={setSelectedProjectId}
                />
              ) : null
            }
          />
        </div>
      </header>

      <main className="app-page-frame space-y-5 py-6 lg:py-8">
        <IngestionStatusWidget />

        <section className="rounded-3xl border border-app-border bg-app-bg p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-app-text">
              Team overview
            </h2>
            <p className="text-sm text-app-text-muted">
              Track the current status of your team and onboarding progress.
            </p>
          </div>

          <TeamManagementWidget projectId={selectedProjectId} />
        </section>

        <section className="rounded-3xl border border-app-border bg-app-bg p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-app-text">Insights</h2>
            <p className="text-sm text-app-text-muted">
              Frequently asked questions and onboarding knowledge gaps.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <FaqWidget />
            <KnowledgeGapWidget />
          </div>
        </section>
      </main>
    </div>
  );
}
