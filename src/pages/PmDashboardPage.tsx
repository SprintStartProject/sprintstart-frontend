import { BriefcaseBusiness, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { IngestionStatusWidget } from "../features/data-ingestion/components/IngestionStatusWidget";
import { FaqWidget } from "../features/faq/components/FaqWidget";
import { KnowledgeGapWidget } from "../features/knowledge-gaps/components/KnowledgeGapWidget";
import { useProjectContext } from "../features/projects/useProjectContext";
import { TeamManagementWidget } from "../features/team-management/components/TeamManagementWidget";
import { ProjectRolesModal } from "../features/team-management/components/ProjectRolesModal";

/**
 * Landing page for PM/HR/Admin users. Surfaces at-a-glance widgets for
 * ingestion health, team onboarding progress, recurring FAQ questions, and
 * knowledge gaps, each linking to its full detail page.
 */
export function PmDashboardPage() {
  // The project is chosen globally in the sidebar switcher.
  const { selectedProjectId } = useProjectContext();
  const [rolesModalOpen, setRolesModalOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={BriefcaseBusiness}
            title="PM Dashboard"
            subtitle="Track team onboarding, spot recurring questions and keep knowledge gaps visible."
          />
        </div>
      </header>

      <main className="app-page-frame space-y-5 py-6 lg:py-8">
        <IngestionStatusWidget />

        <section className="rounded-3xl border border-app-border bg-app-bg p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-app-text">
                Team overview
              </h2>
              <p className="text-sm text-app-text-muted">
                Track the current status of your team and onboarding progress.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRolesModalOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-app-border px-3 py-1.5 text-sm font-medium text-app-text-muted transition-colors hover:border-app-brand-border-strong hover:text-app-text"
            >
              <Plus className="h-4 w-4" />
              Manage role
            </button>
          </div>

          <TeamManagementWidget projectId={selectedProjectId} />
        </section>

        <ProjectRolesModal
          open={rolesModalOpen}
          onClose={() => setRolesModalOpen(false)}
        />

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
