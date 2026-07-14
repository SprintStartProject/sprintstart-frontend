import { BriefcaseBusiness } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { IngestionStatusWidget } from "../features/data-ingestion/components/IngestionStatusWidget";
import { FaqWidget } from "../features/faq/components/FaqWidget";
import { KnowledgeGapWidget } from "../features/knowledge-gaps/components/KnowledgeGapWidget";
import { TeamManagementWidget } from "../features/team-management/components/TeamManagementWidget";

/**
 * Landing page for PM/HR/Admin users. Surfaces four at-a-glance widgets -
 * team onboarding progress, data ingestion sync health, recurring FAQ
 * questions, and knowledge gaps - each linking to its full detail page.
 */
export function PmDashboardPage() {
    return (
        <div className="min-h-screen bg-app-bg">
            <header className="border-b border-app-border bg-app-bg">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                    <PageHeader
                        icon={BriefcaseBusiness}
                        title="PM Dashboard"
                        subtitle="Track team onboarding, spot recurring questions and keep knowledge gaps visible."
                    />
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
                <IngestionStatusWidget />
                <TeamManagementWidget />

                {/* Insights Section */}
                <section className="rounded-3xl border border-app-border bg-app-bg p-4 shadow-sm">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-app-text">
                            Insights
                        </h2>
                        <p className="text-sm text-app-text-muted">
                            Frequently asked questions and onboarding knowledge
                            gaps.
                        </p>
                    </div>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <FaqWidget />
                        <KnowledgeGapWidget />
                    </div>
                </section>
            </main>
        </div>
    );
}
