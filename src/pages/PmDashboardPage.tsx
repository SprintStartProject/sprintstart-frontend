import { BriefcaseBusiness } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { IngestionStatusWidget } from "../features/data-ingestion/components/IngestionStatusWidget";
import { FaqWidget } from "../features/faq/components/FaqWidget";
import { KnowledgeGapWidget } from "../features/knowledge-gaps/components/KnowledgeGapWidget";
import { useProjectContext } from "../features/projects/useProjectContext";
import { TeamManagementWidget } from "../features/team-management/components/TeamManagementWidget";
import { SpotlightCard } from "../components/ui/SpotlightCard";

/**
 * Landing page for PM/HR/Admin users. Surfaces at-a-glance widgets for
 * ingestion health, team onboarding progress, recurring FAQ questions, and
 * knowledge gaps, each linking to its full detail page.
 */
export function PmDashboardPage() {
  // The project is chosen globally in the sidebar switcher.
  const { selectedProjectId } = useProjectContext();

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
        <SpotlightCard roundedClassName="rounded-2xl">
        <IngestionStatusWidget />
      </SpotlightCard>

        <SpotlightCard roundedClassName="rounded-3xl">
        <section className="p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-app-text">Team overview</h2>
            <p className="text-sm text-app-text-muted">
              Track the current status of your team and onboarding progress.
            </p>
          </div>

          <TeamManagementWidget projectId={selectedProjectId} />
        </section>
      </SpotlightCard>

        <SpotlightCard roundedClassName="rounded-3xl">
        <section className="p-4">
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
      </SpotlightCard>
      </main>
    </div>
  );
}
