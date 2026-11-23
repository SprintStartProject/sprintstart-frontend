import { useState } from "react";
import { UserMinus } from "lucide-react";

import { MainContent } from "../components/layout/MainContent";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { DepartureForm, RiskResults, useProjectMembers, useRiskMap } from "../features/offboarding";
import { useProjectContext } from "../features/projects";
import type { RiskQuery } from "../services/offboardingTypes";

/**
 * What the project loses when people leave: name who is leaving and see which files lose the people
 * who know them, most urgent first.
 *
 * The ranking comes from the project's recorded history. It is about files, never about how well a
 * person works.
 */
export function OffboardingPage() {
  const { selectedProjectId } = useProjectContext();
  const [query, setQuery] = useState<RiskQuery | null>(null);
  const { data: map, loading, error } = useRiskMap(selectedProjectId, query);
  const roster = useProjectMembers(selectedProjectId);
  const team = {
    members: roster.data?.members ?? [],
    loading: roster.loading,
    failed: roster.error,
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={UserMinus}
            title="Offboarding"
            subtitle="Which files lose the people who know them when somebody leaves, and which matter most."
          />
        </div>
      </header>

      <MainContent className="app-page-frame space-y-6 py-6 lg:py-8">
        <DepartureForm team={team} busy={loading} onSubmit={setQuery} />
        {error && (
          <EmptyState title="The ranking could not be computed" size="sm">
            The history could not be read. Try again in a moment.
          </EmptyState>
        )}
        {map && <RiskResults map={map} />}
      </MainContent>
    </div>
  );
}
