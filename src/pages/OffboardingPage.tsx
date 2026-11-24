import { useState } from "react";
import { History, ListOrdered, Ruler, UserMinus, Users } from "lucide-react";

import { MainContent } from "../components/layout/MainContent";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { SegmentedTabs, type SegmentedTabOption } from "../components/ui/SegmentedTabs";
import {
  DepartureForm,
  IdentitiesPanel,
  MetricsWalkthrough,
  RiskResults,
  SaveMapBar,
  SavedMapsPanel,
  useProjectMembers,
  useRiskMap,
} from "../features/offboarding";
import { useProjectContext } from "../features/projects";
import type { RiskQuery } from "../services/offboardingTypes";

type View = "ranking" | "metrics" | "saved" | "identities";

const VIEWS: SegmentedTabOption<View>[] = [
  { value: "ranking", label: "Ranking", icon: <ListOrdered className="h-4 w-4" aria-hidden /> },
  { value: "metrics", label: "Metrics", icon: <Ruler className="h-4 w-4" aria-hidden /> },
  { value: "saved", label: "Saved maps", icon: <History className="h-4 w-4" aria-hidden /> },
  { value: "identities", label: "Identities", icon: <Users className="h-4 w-4" aria-hidden /> },
];

/**
 * What the project loses when people leave: name who is leaving and see which files lose the people
 * who know them, most urgent first. Rankings can be saved and compared, and the names in the history
 * matched to the members of the project.
 *
 * The ranking comes from the project's recorded history. It is about files, never about how well a
 * person works.
 */
export function OffboardingPage() {
  const { selectedProjectId } = useProjectContext();
  const [view, setView] = useState<View>("ranking");
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
        <SegmentedTabs
          value={view}
          options={VIEWS}
          onChange={setView}
          layoutId="offboarding-view-pill"
          ariaLabel="Offboarding views"
        />
        <div hidden={view !== "ranking"} className="space-y-6">
          <DepartureForm team={team} busy={loading} onSubmit={setQuery} />
          {error && (
            <EmptyState title="The ranking could not be computed" size="sm">
              The history could not be read. Try again in a moment.
            </EmptyState>
          )}
          {map && query && (
            <>
              <SaveMapBar projectId={selectedProjectId} query={query} />
              <RiskResults map={map} />
            </>
          )}
        </div>
        {view === "metrics" && <MetricsWalkthrough map={map} />}
        {view === "saved" && <SavedMapsPanel projectId={selectedProjectId} />}
        {view === "identities" && <IdentitiesPanel projectId={selectedProjectId} />}
      </MainContent>
    </div>
  );
}
