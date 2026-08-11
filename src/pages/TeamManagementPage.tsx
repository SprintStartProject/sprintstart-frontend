import { Users, ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { TeamMemberFilters } from "../features/team-management/components/TeamMemberFilters";
import { TeamMemberCard } from "../features/team-management/components/TeamMemberCard";
import { RoleManagementTab } from "../features/team-management/components/RoleManagementTab";
import { TeamManagementTabSwitcher } from "../features/team-management/components/TeamManagementTabSwitcher";
import {
  TEAM_MANAGEMENT_TAB_ORDER,
  type TeamManagementTab,
  type TeamOverviewFilters,
  type TeamOverviewUser,
  type ProjectRole,
} from "../features/team-management/types";
import { getTeamOverview, getProjectRoles } from "../services/teamManagementService";
import { ApiError } from "../services/apiClient";
import { PageHeader } from "../components/layout/PageHeader";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";

export function TeamManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<TeamOverviewUser[]>([]);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TeamManagementTab>("members");
  const [filters, setFilters] = useState<TeamOverviewFilters>({
    roleId: "all",
    sortBy: "LONGEST_STEP",
  });

  const loadTeamOverview = useCallback(async () => {
    const [usersData, rolesData] = await Promise.all([getTeamOverview(), getProjectRoles()]);

    setUsers(usersData);
    setRoles(rolesData);
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      try {
        await loadTeamOverview();
        setLoadError(null);
      } catch (error) {
        // Without this the page would sit on its loading text forever,
        // which looks like a blank screen rather than a failed request.
        setLoadError(
          error instanceof ApiError ? error.message : "The team overview could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadInitialData();
  }, [loadTeamOverview]);

  // Two-finger swipe between the tabs, for people who would rather not aim
  // at the bar.
  const swipeRef = useSwipeableTabs<TeamManagementTab, HTMLElement>({
    order: TEAM_MANAGEMENT_TAB_ORDER,
    value: activeTab,
    onChange: setActiveTab,
  });

  const filteredUsers = useMemo(() => {
    const result = users.filter((user) => {
      return filters.roleId === "all" || user.roles.some((role) => role.id === filters.roleId);
    });

    const getStartedAtTime = (user: TeamOverviewUser) => {
      if (!user.currentStep?.startedAt) {
        return 0;
      }

      return new Date(user.currentStep.startedAt).getTime();
    };

    result.sort((a, b) => {
      switch (filters.sortBy) {
        case "LONGEST_STEP":
          return getStartedAtTime(a) - getStartedAtTime(b);

        case "SHORTEST_STEP":
          return getStartedAtTime(b) - getStartedAtTime(a);

        case "HIGHEST_PROGRESS":
          return b.progressPercentage - a.progressPercentage;

        case "LOWEST_PROGRESS":
          return a.progressPercentage - b.progressPercentage;

        default:
          return 0;
      }
    });

    return result;
  }, [users, filters]);

  // One badge for both tabs: the number shown always belongs to whatever the
  // panel below is listing.
  const [headerCount, headerLabel] =
    activeTab === "members"
      ? ([filteredUsers.length, "members"] as const)
      : ([roles.length, roles.length === 1 ? "role" : "roles"] as const);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <p className="text-sm text-app-text-muted">Loading team overview...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg px-6">
        <p className="text-sm text-app-danger-text">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg">
      <header className="relative z-40 border-b border-app-border bg-app-bg">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            onClick={() => void navigate("/pm-dashboard")}
            icon={<ArrowLeft className="h-4 w-4" />}
            className="mb-4"
          >
            Back to PM-Dashboard
          </Button>

          <PageHeader
            icon={Users}
            title="Team Management"
            subtitle="Monitor onboarding progress across team members and manage project roles."
            actions={
              <div className="rounded-2xl border border-app-brand-border bg-app-brand-soft px-4 py-2 text-right">
                <div className="text-3xl font-bold text-app-brand">{headerCount}</div>
                <div className="text-xs font-medium text-app-brand-text">{headerLabel}</div>
              </div>
            }
          />
        </div>
      </header>

      <main ref={swipeRef} className="mx-auto max-w-7xl px-4 py-6 pt-8 pb-24 sm:px-6 lg:px-8">
        <div className="mb-6">
          <TeamManagementTabSwitcher activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <SlidingTabPanel activeKey={activeTab} index={TEAM_MANAGEMENT_TAB_ORDER.indexOf(activeTab)}>
          {activeTab === "members" ? (
            <div className="min-w-0">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-app-text">Team members</h2>
                  <p className="text-sm text-app-text-muted">
                    {filteredUsers.length} of {users.length} members shown
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <TeamMemberFilters roles={roles} filters={filters} onFiltersChange={setFilters} />
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-app-border bg-app-surface p-8 text-center">
                  <p className="text-sm text-app-text-muted">
                    No team members found for this filter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredUsers.map((user) => (
                    <TeamMemberCard key={user.userId} user={user} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <RoleManagementTab roles={roles} users={users} onDataChanged={loadTeamOverview} />
          )}
        </SlidingTabPanel>
      </main>
    </div>
  );
}
