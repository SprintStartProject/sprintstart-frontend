import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clock,
  Gauge,
  Hand,
  Shield,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../components/ui/FilterSelect";
import { SkeletonGroup, SkeletonLine } from "../components/ui/Skeleton";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useDelayedFlag } from "../hooks/useDelayedFlag";
import { useQueryFetch } from "../hooks/useQueryFetch";
import { useAttention } from "../features/onboarding-metrics/hooks/useAttention";
import { buildAttentionQueue } from "../features/pm-area/attentionQueue";
import { MemberRow } from "../features/pm-area/components/MemberRow";
import { PmSectionHeader, PmStat } from "../features/pm-area/components/PmCard";
import { PmFilterChip, PmListToolbar } from "../features/pm-area/components/PmListToolbar";
import { daysOnStep, memberName, memberStage } from "../features/pm-area/memberStatus";
import { ROSTER_COLUMNS } from "../features/pm-area/rosterLayout";
import { teamProgressData } from "../features/pm-area/teamProgress";
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
 * the roster opens sorted by time on step, longest first.
 *
 * The sort has no select of its own any more: the "Time on step" and "Progress" column headers
 * sort, and a select beside them saying "Longest on step" was the same control twice.
 */
type StatusFilter = "all" | "attention";

const STATUS_FILTERS: readonly StatusFilter[] = ["all", "attention"];

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "Everyone",
  attention: "Needs you",
};

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
          // A step can come without its title (a path mid-edit); search must not throw on it.
          (member.currentStep?.title ?? "").toLowerCase().includes(normalizedQuery)),
    ),
    sortBy,
  );

  const roleOptions: FilterSelectOption<string>[] = [
    { value: "all", label: "All roles" },
    ...(roles ?? []).map((role) => ({ value: role.id, label: role.name })),
  ];

  const hasNarrowing = normalizedQuery !== "" || roleId !== "all" || statusFilter !== "all";

  const doneCount = members.filter((member) => memberStage(member) === "done").length;
  // The same average the overview's Team progress card shows.
  const { averageProgress } = teamProgressData(members);
  const withoutRole = members.filter((member) => member.roles.length === 0).length;
  // What is open with the manager, by kind — the part of "Need you" only they can close.
  const openOfKind = (kind: "skip" | "feedback") =>
    [...attentionById.values()].filter((entry) =>
      entry.reasons.some((reason) => reason.kind === kind),
    ).length;
  const openSkips = openOfKind("skip");
  const openFeedback = openOfKind("feedback");
  const needYouHint =
    openSkips + openFeedback > 0
      ? [
          openSkips > 0 && `${openSkips} skip ${openSkips === 1 ? "request" : "requests"}`,
          openFeedback > 0 && `${openFeedback} feedback`,
        ]
          .filter(Boolean)
          .join(" · ") + " open"
      : statusCounts.attention > 0
        ? "Waiting on a review or stuck"
        : "Nobody waiting";
  const figuresReady = Boolean(roster);

  const showMembers = (filter: StatusFilter) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete(TEAM_TAB_PARAM);
        if (filter === "all") params.delete("filter");
        else params.set("filter", filter);
        return params;
      },
      { replace: true },
    );
  };

  const showRoles = () => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set(TEAM_TAB_PARAM, "roles");
        return params;
      },
      { replace: true },
    );
  };

  const resetMembers = () => {
    setQuery("");
    setRoleId("all");
    setStatusFilter("all");
    setSortBy("LONGEST_STEP");
  };

  return (
    <section aria-label="Team">
      <PmSectionHeader
        title="Team"
        description="Everybody on this project, where they are in their onboarding, and the roles they hold."
      />
      {/* The same row of figures that opens Questions and Knowledge gaps — and like theirs, a
          figure that stands for a list is a way into it. Members and Roles themselves are in
          the workspace's tab bar, grown out of the Team tab. */}
      <section aria-label="Key figures" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PmStat
          icon={Users}
          label="Members"
          value={figuresReady ? members.length : "—"}
          hint={figuresReady ? `${doneCount} through onboarding` : "Loading the team"}
          onClick={() => showMembers("all")}
        />
        <PmStat
          icon={Hand}
          label="Need you"
          value={figuresReady ? statusCounts.attention : "—"}
          hint={needYouHint}
          attention={statusCounts.attention > 0}
          onClick={() => showMembers("attention")}
        />
        <PmStat
          icon={Gauge}
          tone="cyan"
          label="Average progress"
          value={figuresReady ? `${averageProgress}%` : "—"}
          hint="Across everyone's path"
        />
        <PmStat
          icon={Shield}
          tone="purple"
          label="Roles"
          value={roles ? roles.length : "—"}
          hint={
            figuresReady
              ? withoutRole > 0
                ? `${withoutRole} ${withoutRole === 1 ? "member" : "members"} without one`
                : "Everyone has a role"
              : "Loading"
          }
          attention={figuresReady && withoutRole > 0}
          onClick={showRoles}
        />
      </section>
      <SlidingTabPanel activeKey={activeTab} index={TEAM_MANAGEMENT_TAB_ORDER.indexOf(activeTab)}>
        {activeTab === "members" ? (
          <div className="space-y-4">
            <PmListToolbar
              search={{
                label: "Search members",
                placeholder: "Search by name or step…",
                value: query,
                onChange: setQuery,
              }}
              filtersLabel="Filter members by status"
              filters={STATUS_FILTERS.map((filter) => (
                <PmFilterChip
                  key={filter}
                  active={statusFilter === filter}
                  onClick={() => setStatusFilter(filter)}
                  label={STATUS_LABEL[filter]}
                  count={roster ? statusCounts[filter] : undefined}
                  dotClassName={STATUS_DOT[filter]}
                  flagged={filter !== "all"}
                />
              ))}
              shown={roster ? visibleMembers.length : undefined}
              total={roster ? members.length : undefined}
              onReset={hasNarrowing || sortBy !== "LONGEST_STEP" ? resetMembers : undefined}
              extra={
                <FilterSelect
                  label="Filter team members by role"
                  value={roleId}
                  options={roleOptions}
                  onChange={setRoleId}
                  disabled={(roles?.length ?? 0) === 0}
                  className="w-40"
                />
              }
            />

            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
              <div
                className={`hidden gap-x-4 border-b border-app-border-muted px-6 py-2.5 text-[11px] font-semibold tracking-wider text-app-text-subtle uppercase md:grid ${ROSTER_COLUMNS}`}
              >
                <span>Member</span>
                {/* Named for what it sorts by, not for what the rows show: "Where they are"
                    over a sort arrow read like a second progress sort. The step itself is
                    obvious from every row; the clock matches each row's day count. */}
                <span>
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
