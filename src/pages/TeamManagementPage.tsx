import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Clock, Search, Shield, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { daysOnStep, memberName } from "../features/pm-area/memberStatus";
import { ROSTER_COLUMNS } from "../features/pm-area/rosterLayout";
import { useMemberPeek } from "../features/pm-area/useMemberPeek";
import { useTeamRoster } from "../features/pm-area/useTeamRoster";
import { TEAM_TAB_PARAM } from "../features/pm-area/pmWorkspacePaths";
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

/**
 * Two chips: everyone, and who needs the manager (any reason — a skip, feedback, a waiting
 * review, drifting, a long step).
 *
 * "Waiting on you" used to be a chip of its own beside "Needs you", but it was only the first
 * half of it (skips and feedback), and two chips that mostly list the same people read as one
 * too many. The reasons column in every row says which kind of "needs you" it is. The stage
 * chips (not started / underway / done) went too — the progress column and the sort answer
 * that — and so did "Long on a step": everyone on a step too long is in "Needs you" already, and
 * "Longest on step" sorts them to the top.
 */
type StatusFilter = "all" | "attention";

const STATUS_FILTERS: readonly StatusFilter[] = ["all", "attention"];

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "Everyone",
  attention: "Needs you",
};

const SORT_OPTIONS: FilterSelectOption<TeamOverviewFilters["sortBy"]>[] = [
  { value: "LONGEST_STEP", label: "Longest on step" },
  { value: "SHORTEST_STEP", label: "Shortest on step" },
  { value: "HIGHEST_PROGRESS", label: "Highest progress" },
  { value: "LOWEST_PROGRESS", label: "Lowest progress" },
];

type SortColumn = "step" | "progress";

/** Which column a sort belongs to, and which way it runs. */
const SORT_COLUMN: Record<TeamOverviewFilters["sortBy"], { column: SortColumn; desc: boolean }> = {
  LONGEST_STEP: { column: "step", desc: true },
  SHORTEST_STEP: { column: "step", desc: false },
  HIGHEST_PROGRESS: { column: "progress", desc: true },
  LOWEST_PROGRESS: { column: "progress", desc: false },
};

/**
 * A column header that sorts the roster by its column — "Where they are" by how long each
 * member has been on their current step, "Progress" by progress. The first press sorts the way
 * a manager usually wants it (longest, highest first); pressing the active column again flips it.
 */
function SortHeader({
  column,
  label,
  icon: LeadIcon,
  sortLabel,
  sortBy,
  onSort,
}: {
  column: SortColumn;
  label: string;
  /** Shown before the label — the clock that marks "time on step" in every row. */
  icon?: LucideIcon;
  /** What the sort actually orders by, for the accessible name and tooltip. */
  sortLabel: string;
  sortBy: TeamOverviewFilters["sortBy"];
  onSort: (next: TeamOverviewFilters["sortBy"]) => void;
}) {
  const current = SORT_COLUMN[sortBy];
  const active = current.column === column;
  const Icon = !active ? ArrowUpDown : current.desc ? ArrowDown : ArrowUp;

  const toggle = () => {
    const desc = active ? !current.desc : true;
    if (column === "step") onSort(desc ? "LONGEST_STEP" : "SHORTEST_STEP");
    else onSort(desc ? "HIGHEST_PROGRESS" : "LOWEST_PROGRESS");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Sort by ${sortLabel}`}
      aria-pressed={active}
      title={`Sort by ${sortLabel}`}
      className={`-mx-1 inline-flex items-center gap-1 rounded px-1 tracking-wider uppercase transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
        active ? "text-app-text" : "hover:text-app-text"
      }`}
    >
      {LeadIcon && <LeadIcon aria-hidden="true" className="h-3 w-3" />}
      {label}
      <Icon aria-hidden="true" className={`h-3 w-3 ${active ? "" : "opacity-50"}`} />
    </button>
  );
}

/** The dot each chip carries — the same colours the overview uses for these states. */
const STATUS_DOT: Partial<Record<StatusFilter, string>> = {
  attention: "bg-app-warning-solid",
};

/**
 * Reads `?filter=` into a chip. Links from before the chips were merged still land somewhere
 * sensible: "waiting" and "stuck" were parts of "needs you", and the stage filters have no chip
 * any more.
 */
function parseStatusFilter(value: string | null): StatusFilter {
  if (value === "waiting" || value === "stuck") return "attention";
  return value !== null && (STATUS_FILTERS as readonly string[]).includes(value)
    ? (value as StatusFilter)
    : "all";
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

  // Read from the URL on every render rather than copied into state once: the workspace's
  // swipe moves between Members and Roles by changing this parameter.
  const activeTab: TeamManagementTab =
    searchParams.get(TEAM_TAB_PARAM) === "roles" ? "roles" : "members";
  const [query, setQuery] = useState("");
  const [roleId, setRoleId] = useState("all");
  const [sortBy, setSortBy] = useState<TeamOverviewFilters["sortBy"]>("LONGEST_STEP");

  const statusFilter = parseStatusFilter(searchParams.get("filter"));

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
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (tab === "roles") params.set(TEAM_TAB_PARAM, "roles");
        else params.delete(TEAM_TAB_PARAM);
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
  // Who needs the manager and why, by person — the chips count from it and every row shows it.
  const attentionById = useMemo(
    () =>
      new Map(
        buildAttentionQueue(members, attention?.items ?? []).map((entry) => [entry.userId, entry]),
      ),
    [members, attention],
  );

  const matchesStatus = (member: TeamOverviewUser, filter: StatusFilter) => {
    switch (filter) {
      case "all":
        return true;
      case "attention":
        return attentionById.has(member.userId);
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

  const statusChip = (filter: StatusFilter) => {
    const active = statusFilter === filter;
    const flagged = filter !== "all" && statusCounts[filter] > 0;
    const dot = STATUS_DOT[filter];

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
        } ${!active && roster && statusCounts[filter] === 0 && filter !== "all" ? "opacity-60" : ""}`}
      >
        {dot && (
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : dot}`}
          />
        )}
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
  };

  return (
    <section aria-label="Team">
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
      <SlidingTabPanel activeKey={activeTab} index={TEAM_MANAGEMENT_TAB_ORDER.indexOf(activeTab)}>
        {activeTab === "members" ? (
          <div className="space-y-4">
            {/* One row: search, the status chips, the role filter. Sorting is on the headers. */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Sized on a wrapper: with an icon, `Input` puts its `className` on the <input>
                  inside its own full-width box, so flex sizing given to it never reached the
                  box that actually sits in this row. */}
              <div className="min-w-0 flex-1 sm:max-w-xs">
                <Input
                  size="sm"
                  icon={<Search className="h-4 w-4" />}
                  aria-label="Search members"
                  placeholder="Search by name or step…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>

              <div
                role="group"
                aria-label="Filter members by status"
                className="flex flex-wrap items-center gap-2"
              >
                {STATUS_FILTERS.map(statusChip)}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <FilterSelect
                  label="Filter team members by role"
                  value={roleId}
                  options={roleOptions}
                  onChange={setRoleId}
                  disabled={(roles?.length ?? 0) === 0}
                  className="w-40"
                />
                {/* Sorting lives on the column headers; below `md` those are hidden, so the
                    select stands in for them there only. */}
                <FilterSelect
                  label="Sort team members"
                  value={sortBy}
                  options={SORT_OPTIONS}
                  onChange={setSortBy}
                  className="w-44 md:hidden"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
              <div
                className={`hidden gap-x-4 border-b border-app-border-muted px-6 py-2.5 text-[11px] font-semibold tracking-wider text-app-text-subtle uppercase md:grid ${ROSTER_COLUMNS}`}
              >
                <span>Member</span>
                {/* The column shows where someone is; what it sorts by is how long they have
                    been there — said on the control, with the clock every row's day count
                    carries, so it does not read as a second "progress" sort. */}
                <span className="flex items-center gap-2">
                  <span>Where they are</span>
                  <span aria-hidden="true" className="text-app-border">
                    ·
                  </span>
                  <SortHeader
                    column="step"
                    label="Time on step"
                    icon={Clock}
                    sortLabel="time on current step"
                    sortBy={sortBy}
                    onSort={setSortBy}
                  />
                </span>
                <span>Open with you</span>
                <span>
                  <SortHeader
                    column="progress"
                    label="Progress"
                    sortLabel="progress"
                    sortBy={sortBy}
                    onSort={setSortBy}
                  />
                </span>
                <span />
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
                        profileLink
                        reasons={attentionById.get(member.userId)?.reasons ?? []}
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
    </section>
  );
}
