import { useMemo, useState } from "react";
import { Search, Shield, Users, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../components/ui/FilterSelect";
import { Input } from "../components/ui/Input";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { SkeletonGroup, SkeletonLine } from "../components/ui/Skeleton";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useDelayedFlag } from "../hooks/useDelayedFlag";
import { useQueryFetch } from "../hooks/useQueryFetch";
import { useAttention } from "../features/onboarding-metrics/hooks/useAttention";
import { buildAttentionQueue } from "../features/pm-area/attentionQueue";
import { MemberRow } from "../features/pm-area/components/MemberRow";
import { PmSectionHeader } from "../features/pm-area/components/PmCard";
import {
  daysOnStep,
  isAtRisk,
  memberName,
  memberStage,
  waitingOn,
} from "../features/pm-area/memberStatus";
import { useMemberPeek } from "../features/pm-area/useMemberPeek";
import { useTeamRoster } from "../features/pm-area/useTeamRoster";
import { useProjectContext } from "../features/projects/useProjectContext";
import { RoleManagementTab } from "../features/team-management/components/RoleManagementTab";
import {
  TEAM_MANAGEMENT_TAB_ORDER,
  type TeamManagementTab,
  type TeamOverviewFilters,
  type TeamOverviewUser,
} from "../features/team-management/types";
import { queryKeys } from "../services/queryKeys";
import { getProjectRoles } from "../services/teamManagementService";

type StatusFilter = "all" | "attention" | "waiting" | "stuck" | "not-started" | "underway" | "done";

const STATUS_FILTERS: readonly StatusFilter[] = [
  "all",
  "attention",
  "waiting",
  "stuck",
  "not-started",
  "underway",
  "done",
];

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "Everyone",
  attention: "Needs you",
  waiting: "Waiting on you",
  stuck: "Long on a step",
  "not-started": "Not started",
  underway: "Underway",
  done: "Done",
};

const SORT_OPTIONS: FilterSelectOption<TeamOverviewFilters["sortBy"]>[] = [
  { value: "LONGEST_STEP", label: "Longest on step" },
  { value: "SHORTEST_STEP", label: "Shortest on step" },
  { value: "HIGHEST_PROGRESS", label: "Highest progress" },
  { value: "LOWEST_PROGRESS", label: "Lowest progress" },
];

function isStatusFilter(value: string | null): value is StatusFilter {
  return value !== null && (STATUS_FILTERS as readonly string[]).includes(value);
}

function sortMembers(members: TeamOverviewUser[], sortBy: TeamOverviewFilters["sortBy"]) {
  // Members without a current step sort as "no time on a step", after everybody who has one.
  const days = (member: TeamOverviewUser) => daysOnStep(member) ?? -1;

  return [...members].sort((a, b) => {
    switch (sortBy) {
      case "LONGEST_STEP":
        return days(b) - days(a);
      case "SHORTEST_STEP":
        return days(a) - days(b);
      case "HIGHEST_PROGRESS":
        return b.progressPercentage - a.progressPercentage;
      case "LOWEST_PROGRESS":
        return a.progressPercentage - b.progressPercentage;
      default:
        return 0;
    }
  });
}

function RosterSkeleton() {
  return (
    <SkeletonGroup label="Loading team overview" className="space-y-2 p-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-2">
          <SkeletonLine className="h-9 w-9 shrink-0 rounded-full" />
          <SkeletonLine className="w-1/4" />
          <SkeletonLine className="hidden w-1/3 md:block" />
          <SkeletonLine className="ml-auto hidden w-32 md:block" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/**
 * The team: everybody on the selected project as one scannable roster, and the roles tab.
 *
 * The roster used to be a grid of cards, each a link to a separate profile page — looking at
 * three people meant three page loads and three trips back. Rows now open the member side
 * panel over the list, so a manager can go down the team without losing their place; the full
 * profile is still one press away inside the panel.
 *
 * The status filter lives in the URL (`?filter=`), which is what lets the overview's figures
 * link straight to "who is waiting on you" instead of to the unfiltered team.
 */
export function TeamManagementPage() {
  const { selectedProjectId } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const { memberId, openMember } = useMemberPeek();

  const [activeTab, setActiveTab] = useState<TeamManagementTab>(
    searchParams.get("tab") === "roles" ? "roles" : "members",
  );
  const [query, setQuery] = useState("");
  const [roleId, setRoleId] = useState("all");
  const [sortBy, setSortBy] = useState<TeamOverviewFilters["sortBy"]>("LONGEST_STEP");

  const filterParam = searchParams.get("filter");
  const statusFilter: StatusFilter = isStatusFilter(filterParam) ? filterParam : "all";

  const setStatusFilter = (next: StatusFilter) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next === "all") params.delete("filter");
        else params.set("filter", next);
        return params;
      },
      { replace: true },
    );
  };

  const changeTab = (tab: TeamManagementTab) => {
    setActiveTab(tab);
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (tab === "roles") params.set("tab", "roles");
        else params.delete("tab");
        return params;
      },
      { replace: true },
    );
  };

  const queryClient = useQueryClient();
  const { data: roster, loading, error } = useTeamRoster();
  const { data: roles } = useQueryFetch(
    queryKeys.projectRoles.byProject(selectedProjectId),
    getProjectRoles,
  );
  const { attention } = useAttention(selectedProjectId);

  const showLoadingSkeleton = useDelayedFlag(loading);

  const members = useMemo(() => roster ?? [], [roster]);
  const attentionIds = useMemo(
    () =>
      new Set(buildAttentionQueue(members, attention?.items ?? []).map((entry) => entry.userId)),
    [members, attention],
  );

  const matchesStatus = (member: TeamOverviewUser, filter: StatusFilter) => {
    switch (filter) {
      case "all":
        return true;
      case "attention":
        return attentionIds.has(member.userId);
      case "waiting":
        return waitingOn(member).length > 0;
      case "stuck":
        return isAtRisk(member);
      default:
        return memberStage(member) === filter;
    }
  };

  const statusCounts = Object.fromEntries(
    STATUS_FILTERS.map((filter) => [
      filter,
      members.filter((member) => matchesStatus(member, filter)).length,
    ]),
  ) as Record<StatusFilter, number>;

  const normalizedQuery = query.trim().toLowerCase();
  const visibleMembers = sortMembers(
    members.filter(
      (member) =>
        matchesStatus(member, statusFilter) &&
        (roleId === "all" || member.roles.some((role) => role.id === roleId)) &&
        (normalizedQuery === "" ||
          memberName(member).toLowerCase().includes(normalizedQuery) ||
          (member.currentStep?.title.toLowerCase().includes(normalizedQuery) ?? false)),
    ),
    sortBy,
  );

  const roleOptions: FilterSelectOption<string>[] = [
    { value: "all", label: "All roles" },
    ...(roles ?? []).map((role) => ({ value: role.id, label: role.name })),
  ];

  const hasNarrowing = normalizedQuery !== "" || roleId !== "all" || statusFilter !== "all";

  return (
    <div>
      <PmSectionHeader
        title="Team"
        description="Everybody on this project, where they are in their onboarding, and the roles they hold."
        actions={
          <SegmentedTabs
            value={activeTab}
            onChange={changeTab}
            layoutId="team-management-tab-pill"
            ariaLabel="Team management sections"
            options={TEAM_MANAGEMENT_TAB_ORDER.map((tab) =>
              tab === "members"
                ? {
                    value: tab,
                    label: "Members",
                    icon: <Users className="h-4 w-4" />,
                    count: roster ? members.length : undefined,
                  }
                : {
                    value: tab,
                    label: "Roles",
                    icon: <Shield className="h-4 w-4" />,
                    count: roles ? roles.length : undefined,
                  },
            )}
          />
        }
      />
      <div className="space-y-5">
        <SlidingTabPanel activeKey={activeTab} index={TEAM_MANAGEMENT_TAB_ORDER.indexOf(activeTab)}>
          {activeTab === "members" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <Input
                  size="sm"
                  icon={<Search className="h-4 w-4" />}
                  aria-label="Search members"
                  placeholder="Search by name or step…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 lg:max-w-xs lg:flex-1"
                />
                <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                  <FilterSelect
                    label="Filter team members by role"
                    value={roleId}
                    options={roleOptions}
                    onChange={setRoleId}
                    className="w-44"
                  />
                  <FilterSelect
                    label="Sort team members"
                    value={sortBy}
                    options={SORT_OPTIONS}
                    onChange={setSortBy}
                    className="w-48"
                  />
                </div>
              </div>

              <div
                role="group"
                aria-label="Filter members by status"
                className="flex [scrollbar-width:none]! gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
              >
                {STATUS_FILTERS.map((filter) => {
                  const active = statusFilter === filter;
                  const flagged =
                    (filter === "attention" || filter === "waiting" || filter === "stuck") &&
                    statusCounts[filter] > 0;

                  return (
                    <button
                      key={filter}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatusFilter(filter)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
                        active
                          ? "border-app-brand bg-app-brand text-white"
                          : "border-app-border bg-app-surface text-app-text-muted hover:border-app-brand-border-strong hover:text-app-text"
                      }`}
                    >
                      {STATUS_LABEL[filter]}
                      {roster && (
                        <span
                          className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                            active
                              ? "bg-white/20 text-white"
                              : flagged
                                ? "bg-app-warning-bg text-app-warning-text"
                                : "bg-app-surface-muted text-app-text-subtle"
                          }`}
                        >
                          {statusCounts[filter]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
                <div
                  aria-hidden="true"
                  className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_9rem_auto] gap-x-4 border-b border-app-border-muted px-6 py-2.5 text-[11px] font-semibold tracking-wider text-app-text-subtle uppercase md:grid"
                >
                  <span>Member</span>
                  <span>Where they are</span>
                  <span>Progress</span>
                  <span className="w-4" />
                </div>

                {showLoadingSkeleton ? (
                  <RosterSkeleton />
                ) : loading ? null : error ? (
                  <div className="p-6">
                    <EmptyState size="sm">The team isn&apos;t available right now.</EmptyState>
                  </div>
                ) : visibleMembers.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 p-8 text-center">
                    <p className="text-sm text-app-text-muted">
                      {members.length === 0
                        ? "Nobody is on this project yet."
                        : "No team members match these filters."}
                    </p>
                    {hasNarrowing && members.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setRoleId("all");
                          setStatusFilter("all");
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-app-brand-text hover:underline"
                      >
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-app-border-muted px-3 py-1.5">
                    {visibleMembers.map((member) => (
                      <li key={member.userId} className="py-0.5">
                        <MemberRow
                          member={member}
                          onOpen={openMember}
                          selected={memberId === member.userId}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <RoleManagementTab
              roles={roles ?? []}
              users={members}
              // Awaited by the tab (it opens a freshly created role right after), so this waits
              // for both reads to land rather than only asking for them.
              onDataChanged={async () => {
                await Promise.all([
                  queryClient.refetchQueries({
                    queryKey: queryKeys.teamOverview.filtered(selectedProjectId || null),
                  }),
                  queryClient.refetchQueries({
                    queryKey: queryKeys.projectRoles.byProject(selectedProjectId),
                  }),
                ]);
              }}
            />
          )}
        </SlidingTabPanel>
      </div>
    </div>
  );
}
