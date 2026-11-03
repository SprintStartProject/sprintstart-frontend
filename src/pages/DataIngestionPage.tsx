import { MainContent } from "../components/layout/MainContent";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel.tsx";
import { DataIngestionHeader } from "../features/data-ingestion/components/DataIngestionHeader.tsx";
import { DataIngestionLoadingState } from "../features/data-ingestion/components/DataIngestionLoadingState.tsx";
import { DataIngestionSectionFilter } from "../features/data-ingestion/components/DataIngestionSectionFilter.tsx";
import { OverviewSection } from "../features/data-ingestion/components/OverviewSection.tsx";
import { SECTION_ORDER, type SectionKey } from "../features/data-ingestion/types.ts";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import {
  AddSourceDialog,
  ConnectorsModal,
  SyncSettingsModal,
} from "./dataIngestion/IngestionModals";
import { IngestionBanners, IngestionPanels } from "./dataIngestion/IngestionPanels";
import { RunsSection, SourcesSection } from "./dataIngestion/IngestionSections";
import { useDataIngestionPage } from "./dataIngestion/useDataIngestionPage";

/**
 * The selected project's sources, their connectors and their ingestion runs, in the
 * sections overview, sources and runs.
 *
 * Bound to `/data-ingestion`, open to `PM`, `HR` and `ADMIN` (`routePermissions` in
 * `src/auth/accessPolicy.ts`). The route is wrapped in `ManagerAreaGuard`, which also
 * requires a PM to manage the selected project. Jira instances are loaded separately from
 * the other sources, because the backend does not report Jira as a project source.
 * `?projectId=` switches the selected project once and is then removed from the URL;
 * `?sourceId=` switches to the sources section and selects that source.
 */
export function DataIngestionPage() {
  const model = useDataIngestionPage();
  const { activeSection, setActiveSection, feed, actions } = model;
  const { data, sources } = feed;
  const isLoading = data.isRunsLoading || actions.isRefreshing;

  // Two-finger swipe between the sections, for people who would rather not aim at the bar.
  const swipeRef = useSwipeableTabs<SectionKey, HTMLElement>({
    order: SECTION_ORDER,
    value: activeSection,
    onChange: setActiveSection,
  });

  const showOverview = activeSection === "overview";
  const showSources = showOverview || activeSection === "sources";
  const showRuns = showOverview || activeSection === "runs";
  const shouldShowInitialLoading =
    (isLoading || (data.isProjectDataLoading && showSources)) && sources.length === 0;

  return (
    // No own height or scroll container here: the app shell in App.tsx already provides
    // `min-h-screen` and the document scroll. Nesting a `h-screen` scroller inside it produced a
    // second scrollbar and dead space below the content once the viewport lost height to a
    // horizontal scrollbar.
    <div>
      <div>
        <DataIngestionHeader
          isLoading={isLoading}
          onAddSource={actions.openAddSource}
          onRefresh={() => void actions.onRefresh()}
        />

        <MainContent ref={swipeRef} className="app-page-shell">
          <div className="space-y-8">
            <IngestionBanners model={model} />

            <DataIngestionSectionFilter
              active={activeSection}
              onChange={setActiveSection}
              sourceCount={feed.health.total}
              runCount={data.runPageMeta?.totalElements ?? data.runs.length}
            />

            {shouldShowInitialLoading ? (
              <DataIngestionLoadingState />
            ) : (
              // Only the section content slides; the loading state above is not a section and
              // would otherwise animate on its way in too.
              <SlidingTabPanel
                activeKey={activeSection}
                index={SECTION_ORDER.indexOf(activeSection)}
                className="space-y-8"
              >
                {showOverview ? (
                  <OverviewSection
                    sources={sources}
                    totalArtifactCount={feed.totalArtifactCount}
                    runs={data.latestRuns}
                    onNavigate={setActiveSection}
                  />
                ) : null}
                {showSources ? <SourcesSection model={model} /> : null}
                {showRuns ? <RunsSection model={model} /> : null}
              </SlidingTabPanel>
            )}
          </div>
        </MainContent>
      </div>

      <IngestionPanels model={model} />
      <ConnectorsModal model={model} />
      <SyncSettingsModal model={model} />
      <AddSourceDialog model={model} />
    </div>
  );
}
