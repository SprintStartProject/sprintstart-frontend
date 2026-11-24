import { Terminal } from "lucide-react";
import { MainContent } from "../components/layout/MainContent";
import { PageHeader } from "../components/layout/PageHeader";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { SCROLL_CONTAINER_ATTRIBUTE } from "../components/ui/useScrollLock";
import { DEFAULT_ACCESS_SOURCE_FILTER } from "../features/access/components/AccessManagementView";
import { useProjectContext } from "../features/projects/useProjectContext";
import { AdminMetrics } from "../features/admin/components/AdminMetrics";
import {
  AdminDrawerLayer,
  CreateWizard,
  UserDeleteDialogs,
} from "../features/admin/page/AdminOverlays";
import { ActiveSection } from "../features/admin/page/AdminSections";
import { AdminLoadError, AdminLoading, AdminTabBar } from "../features/admin/page/AdminTabBar";
import { useAdminNavigation } from "../features/admin/page/useAdminNavigation";
import { useAdminInteractions } from "../features/admin/page/useAdminInteractions";
import { useAdminSources } from "../features/admin/page/useAdminSources";

/**
 * Administration of users, projects and stored access tokens, as three tabs.
 *
 * Bound to `/admin`, open to `HR` and `ADMIN` (`routePermissions` in
 * `src/auth/accessPolicy.ts`). The route is not wrapped in `ManagerAreaGuard`; the sidebar
 * and the dashboard widgets only link here for groups that may open it. In the project
 * drawer, editing the industry, assigning a project manager and deleting the project are
 * `ADMIN` only. `?tab=projects` opens the page on that tab once and is then removed from
 * the URL.
 */
export function AdminPage() {
  const { reloadProjects } = useProjectContext();
  const sources = useAdminSources(DEFAULT_ACCESS_SOURCE_FILTER);
  const interactions = useAdminInteractions(sources, reloadProjects);
  const { data, handoff, tabs } = sources;
  const [swipeRef, navigation] = useAdminNavigation(sources, interactions.drawers);
  const isLoading = data.loadingState === "idle" || data.loadingState === "loading";

  return (
    // The swipe listens on the page rather than the panel: needing to be over the content to
    // change section makes the gesture feel like it only works in some places.
    <div
      ref={swipeRef}
      // This page scrolls here rather than letting the document scroll, so a dialog's scroll lock
      // has to be told where to look -- see `SCROLL_CONTAINER_ATTRIBUTE`.
      {...{ [SCROLL_CONTAINER_ATTRIBUTE]: "" }}
      // Below lg the app shell offsets the page by the 64px fixed mobile header (App's main has
      // pt-[64px] lg:pt-0). A plain h-dvh would then run 64px past the viewport, hiding the last
      // row of content (e.g. the pagination) below the fold, so subtract the header there. It
      // scrolls on its own, so the buddy button's `scroll-padding` on `html` does not reach it.
      className="h-[calc(100dvh-64px)] overflow-y-scroll overscroll-contain max-lg:scroll-pb-26 lg:h-dvh"
    >
      <header className="border-b border-app-border bg-app-bg">
        <div className="admin-page-frame py-4 sm:py-6">
          <PageHeader
            icon={Terminal}
            title="Access Management"
            subtitle="Manage users, projects, access tokens and the skill pool."
            actions={
              <AdminMetrics userCount={data.users.length} projectCount={data.projects.length} />
            }
          />
        </div>
      </header>

      <MainContent className="admin-page-frame py-4 sm:py-6">
        {/* No card around the sections, matching the other tabbed pages: the box drew a second
            frame inside the page frame and made the tab bar look like it belonged to a widget
            rather than to the page. */}
        <AdminTabBar
          tabs={tabs}
          activeTab={handoff.activeTab}
          isRefreshing={navigation.isRefreshing}
          onChange={navigation.changeTab}
          onRefresh={navigation.refresh}
        />

        {/* Clipped horizontally because the section content slides in from the side; without it
            the travel briefly widens the page. `clip` rather than `hidden`, so this does not
            become a scroll container and swallow sticky positioning inside the sections. */}
        <div className="overflow-x-clip">
          {isLoading ? (
            <AdminLoading />
          ) : data.loadingState === "error" ? (
            <AdminLoadError
              message={data.errorMessage}
              onRetry={() => void data.refreshAdminData()}
            />
          ) : (
            // Only the tab content slides; the loading and error states above are not tabs and
            // would otherwise animate on their way in too.
            <SlidingTabPanel activeKey={handoff.activeTab} index={tabs.indexOf(handoff.activeTab)}>
              <ActiveSection sources={sources} interactions={interactions} />
            </SlidingTabPanel>
          )}
        </div>
      </MainContent>

      <AdminDrawerLayer sources={sources} interactions={interactions} />
      <UserDeleteDialogs interactions={interactions} />
      <CreateWizard sources={sources} interactions={interactions} />
    </div>
  );
}
