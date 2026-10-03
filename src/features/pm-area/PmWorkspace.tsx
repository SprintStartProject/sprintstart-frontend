import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  FolderKanban,
  Gauge,
  Inbox,
  LayoutDashboard,
  MessageSquareMore,
  ShieldAlert,
  Users,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { SegmentedTabs, type SegmentedTabOption } from "../../components/ui/SegmentedTabs";
import { SLIDING_PANEL_SECONDS, SlidingTabPanel } from "../../components/ui/SlidingTabPanel";
import { useSwipeableTabs } from "../../hooks/useHorizontalWheelNavigation";
import { PmDashboardPage } from "../../pages/PmDashboardPage";
import { TeamManagementPage } from "../../pages/TeamManagementPage";
import { TeamMemberDetailPage } from "../../pages/TeamMemberDetailPage";
import { FaqPage } from "../faq/components/FaqPage";
import { KnowledgeGapsPage } from "../knowledge-gaps/components/KnowledgeGapsPage";
import { KnowledgeRequestInboxPage } from "../knowledge-request/components/KnowledgeRequestInboxPage";
import { useOpenEscalationCount } from "../knowledge-request/useOpenEscalationCount";
import { OnboardingMetricsPage } from "../onboarding-metrics/components/OnboardingMetricsPage";
import { useProjectContext } from "../projects/useProjectContext";
import { ProjectAnalysisLauncher } from "./analysis/ProjectAnalysisLauncher";
import { MemberPeekPanel } from "./components/MemberPeekPanel";
import { PmHeaderStatus } from "./components/PmHeaderStatus";
import { INBOX_VIEW_PARAM, TEAM_TAB_PARAM } from "./pmWorkspacePaths";
import { usePmSectionViewCounts } from "./usePmSectionViewCounts";
import { MEMBER_PEEK_PARAM } from "./useMemberPeek";

type PmSection = "overview" | "team" | "onboarding" | "questions" | "gaps" | "escalations";

const PM_SECTION_ORDER: readonly PmSection[] = [
  "overview",
  "team",
  "onboarding",
  "questions",
  "gaps",
  "escalations",
];

type SwipeStop = {
  id: string;
  section: PmSection;
  /** The one search parameter that tells this stop apart from its section's other stops. */
  param?: { key: string; value: string | null };
};

/**
 * Every place a two-finger swipe can land, left to right.
 *
 * Team and Escalations each have views of their own (Members and Roles, Open and Durable
 * answers), which grow out of their tab in the one bar while the section is open. The gesture
 * walks them as one flat line — through a section's views, then on to the next section — the
 * way a reader scans the bar.
 */
const SWIPE_STOPS: readonly SwipeStop[] = [
  { id: "overview", section: "overview" },
  { id: "team-members", section: "team", param: { key: TEAM_TAB_PARAM, value: null } },
  { id: "team-roles", section: "team", param: { key: TEAM_TAB_PARAM, value: "roles" } },
  { id: "onboarding", section: "onboarding" },
  { id: "questions", section: "questions" },
  { id: "gaps", section: "gaps" },
  { id: "escalations-open", section: "escalations", param: { key: INBOX_VIEW_PARAM, value: null } },
  {
    id: "escalations-answered",
    section: "escalations",
    param: { key: INBOX_VIEW_PARAM, value: "answered" },
  },
];

const SWIPE_STOP_IDS = SWIPE_STOPS.map((stop) => stop.id);

/**
 * How long the project analysis waits before it comes back when the overview is entered from
 * another section, in milliseconds.
 *
 * Shown at once, it arrived before everything else and in the wrong place: the outgoing section
 * still takes `SLIDING_PANEL_EXIT_MS` to slide out, and a tab with views of its own (Team,
 * Escalations) is still folding them back in — so the bar was too wide for the analysis to fit
 * beside it, and it wrapped under the tabs for a moment before jumping up next to them. By this
 * point the views have folded away (their spring has all but settled) and the overview is sliding
 * in, so the analysis fades in with it, in its place.
 */
const LAUNCHER_REVEAL_DELAY_MS = 250;

function currentStopId(section: PmSection, searchParams: URLSearchParams): string {
  const stop = SWIPE_STOPS.find(
    (candidate) =>
      candidate.section === section &&
      (!candidate.param || searchParams.get(candidate.param.key) === candidate.param.value),
  );

  return (stop ?? SWIPE_STOPS.find((candidate) => candidate.section === section))?.id ?? "overview";
}

/** Where each section lives: the path its tab navigates to. */
const PM_SECTION_PATHS: Record<PmSection, string> = {
  overview: "/pm-dashboard",
  team: "/team-management",
  onboarding: "/insights/onboarding",
  questions: "/insights/faq",
  gaps: "/insights/knowledge-gaps",
  escalations: "/insights/knowledge-requests",
};

type ResolvedSection = {
  section: PmSection;
  /** Distinguishes views inside one section that should still slide, e.g. two profiles. */
  viewKey: string;
  content: ReactNode;
  /** A side panel of the section's own is open (a question, a gap). */
  hasOwnPanel: boolean;
};

function resolveSection(
  pathname: string,
  analysisRevision: number,
  onOpenAnalysis: () => void,
): ResolvedSection {
  const member = matchPath("/team/:userId", pathname);
  if (member?.params.userId) {
    return {
      section: "team",
      viewKey: `team/${member.params.userId}`,
      content: <TeamMemberDetailPage userId={member.params.userId} />,
      hasOwnPanel: false,
    };
  }

  const faq = matchPath("/insights/faq/:groupId?", pathname);
  if (faq) {
    return {
      section: "questions",
      viewKey: "questions",
      content: <FaqPage groupId={faq.params.groupId} />,
      hasOwnPanel: Boolean(faq.params.groupId),
    };
  }

  const gaps = matchPath("/insights/knowledge-gaps/:gapId?", pathname);
  if (gaps) {
    return {
      section: "gaps",
      viewKey: "gaps",
      content: <KnowledgeGapsPage gapId={gaps.params.gapId} />,
      hasOwnPanel: Boolean(gaps.params.gapId),
    };
  }

  if (pathname.startsWith("/team-management")) {
    return {
      section: "team",
      viewKey: "team",
      content: <TeamManagementPage />,
      hasOwnPanel: false,
    };
  }
  if (pathname.startsWith("/insights/knowledge-requests")) {
    return {
      section: "escalations",
      viewKey: "escalations",
      content: <KnowledgeRequestInboxPage />,
      hasOwnPanel: false,
    };
  }
  if (pathname.startsWith("/insights/onboarding")) {
    return {
      section: "onboarding",
      viewKey: "onboarding",
      content: <OnboardingMetricsPage />,
      hasOwnPanel: false,
    };
  }

  return {
    section: "overview",
    viewKey: "overview",
    content: (
      <PmDashboardPage analysisRevision={analysisRevision} onOpenAnalysis={onOpenAnalysis} />
    ),
    hasOwnPanel: false,
  };
}

/**
 * The PM area as one page: one header, one tab bar, and the section underneath sliding in the
 * direction you are moving.
 *
 * A **layout route**, like `AssistantShell`, and for the same reasons. The PM pages used to be
 * separate routes with separate headers: every switch re-mounted the header (whose height
 * depended on what each page put into it), faded the whole page, and waited for that page's
 * lazy chunk — the lag and the jumping header were the same problem. Now the header never
 * changes, every section ships in this one chunk, and switching is a slide.
 *
 * The section is chosen from the URL rather than from child route elements: the old URLs all
 * keep working (`/team/:id`, `/insights/faq/:id`, …), and rendering the sections here instead of
 * through `<Outlet />` means the outgoing section keeps its own props while it slides out.
 *
 * Section-specific controls live at the top of each section, never in the header — a control
 * that appears and vanishes as you cross is exactly what made the header move.
 */
export function PmWorkspace() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, selectedProjectId, isLoading: projectsLoading } = useProjectContext();
  const openEscalations = useOpenEscalationCount(selectedProjectId, true, pathname);

  // Bumped by every finished project analysis, for the overview cards that keep their data
  // outside the shared query cache (the industry card) to read it again.
  const [analysisRevision, setAnalysisRevision] = useState(0);
  // Bumped when the overview asks for the full analysis ("+N more" under the figures): the
  // launcher owns the run, so it is told to start one rather than the overview starting it.
  const [analysisRequest, setAnalysisRequest] = useState(0);
  const requestAnalysis = useCallback(() => setAnalysisRequest((request) => request + 1), []);
  const { section, viewKey, content, hasOwnPanel } = resolveSection(
    pathname,
    analysisRevision,
    requestAnalysis,
  );
  const viewCounts = usePmSectionViewCounts(section);
  const panelOpen = hasOwnPanel || searchParams.has(MEMBER_PEEK_PARAM);
  // A member's full profile is somewhere a manager reads and works, not a stop on the way to the
  // next section: its journey graph pans and zooms under the same two-finger gesture, and a
  // sideways flick while scrolling the path used to throw them back into the roster. The tab bar
  // and the "Team" button still leave it.
  const onMemberProfile = viewKey.startsWith("team/");

  // The project analysis beside the tabs belongs to the overview. Leaving it hides the analysis
  // at once; coming back shows it only after `LAUNCHER_REVEAL_DELAY_MS` (see there). Opening the
  // overview directly shows it straight away — there is nothing to wait for.
  const prefersReducedMotion = useReducedMotion();
  const onOverview = section === "overview";
  const [launcherShown, setLauncherShown] = useState(onOverview);
  // Derived during render, like `SlidingTabPanel`'s direction, so it is gone on the very render
  // that leaves the overview rather than one frame later.
  // Without motion nothing slides or folds, so there is nothing to wait for either.
  if (!onOverview && launcherShown) setLauncherShown(false);
  if (onOverview && !launcherShown && prefersReducedMotion) setLauncherShown(true);
  useEffect(() => {
    if (!onOverview || launcherShown || prefersReducedMotion) return;
    const reveal = window.setTimeout(() => setLauncherShown(true), LAUNCHER_REVEAL_DELAY_MS);
    return () => window.clearTimeout(reveal);
  }, [onOverview, launcherShown, prefersReducedMotion]);

  const goToSection = useCallback(
    (next: PmSection) => {
      if (next === section && pathname === PM_SECTION_PATHS[next]) return;
      void navigate(PM_SECTION_PATHS[next]);
    },
    [navigate, pathname, section],
  );

  const goToStop = useCallback(
    (stopId: string) => {
      const stop = SWIPE_STOPS.find((candidate) => candidate.id === stopId);
      if (!stop) return;

      const param = stop.param;
      const sectionPath = PM_SECTION_PATHS[stop.section];

      // Staying on the same list (Members to Roles): only the tab parameter changes, so the
      // section's other state in the URL — a status filter, say — survives the swipe.
      if (param && pathname === sectionPath) {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            if (param.value === null) next.delete(param.key);
            else next.set(param.key, param.value);
            return next;
          },
          { replace: true },
        );
        return;
      }

      void navigate(param?.value ? `${sectionPath}?${param.key}=${param.value}` : sectionPath);
    },
    [navigate, pathname, setSearchParams],
  );

  // Two-finger horizontal swipe through every stop in `SWIPE_STOPS`, the gesture every tabbed
  // page answers to. Off while a side panel is open: the panels are fixed on top of this
  // element, so a sideways scroll inside one would otherwise bubble up here and switch the
  // section underneath it. Off on a member's full profile too (see `onMemberProfile`).
  const swipeRef = useSwipeableTabs<string, HTMLDivElement>({
    order: SWIPE_STOP_IDS,
    value: currentStopId(section, searchParams),
    onChange: goToStop,
    enabled: !panelOpen && !onMemberProfile,
  });

  // Holds the column at its current height while one section slides out and the next slides in.
  // The panel swaps with `mode="wait"`, so for a moment there is no section at all; the page
  // got shorter, its scrollbar vanished, and the whole layout — header included — jumped
  // sideways by the scrollbar's width and back. Written to the element rather than kept in
  // state, since it only has to outlive the animation.
  const sectionFrameRef = useRef<HTMLDivElement>(null);
  const isFirstViewRef = useRef(true);
  useLayoutEffect(() => {
    const frame = sectionFrameRef.current;
    if (isFirstViewRef.current || !frame) {
      isFirstViewRef.current = false;
      return;
    }

    frame.style.minHeight = `${frame.offsetHeight}px`;
    const release = window.setTimeout(() => {
      frame.style.minHeight = "";
    }, 450);

    return () => window.clearTimeout(release);
  }, [viewKey]);

  // A section switch lands at the top of the next section rather than halfway down it — the
  // page scrolls as a whole, so the previous section's scroll position would otherwise carry.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [viewKey]);

  const options: SegmentedTabOption<PmSection>[] = [
    { value: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
    {
      value: "team",
      label: "Team",
      icon: <Users className="h-4 w-4" />,
      // Members and Roles grow out of the tab while Team is open — no second bar in the section.
      subOptions: [
        {
          value: "members",
          label: "Members",
          count: viewCounts.members,
        },
        {
          value: "roles",
          label: "Roles",
          count: viewCounts.roles,
        },
      ],
      subValue:
        searchParams.get(TEAM_TAB_PARAM) === "roles" && !onMemberProfile ? "roles" : "members",
      onSubChange: (view) => goToStop(`team-${view}`),
      subAriaLabel: "Team views",
    },
    { value: "onboarding", label: "Onboarding", icon: <Gauge className="h-4 w-4" /> },
    { value: "questions", label: "Questions", icon: <MessageSquareMore className="h-4 w-4" /> },
    { value: "gaps", label: "Knowledge gaps", icon: <ShieldAlert className="h-4 w-4" /> },
    {
      value: "escalations",
      label: "Escalations",
      icon: <Inbox className="h-4 w-4" />,
      count: openEscalations > 0 ? openEscalations : undefined,
      subOptions: [
        {
          value: "open",
          label: "Open",
          count: openEscalations,
        },
        {
          value: "answered",
          label: "Durable answers",
          count: viewCounts.answers,
        },
      ],
      subValue: searchParams.get(INBOX_VIEW_PARAM) === "answered" ? "answered" : "open",
      onSubChange: (view) =>
        goToStop(view === "answered" ? "escalations-answered" : "escalations-open"),
      subAriaLabel: "Escalation views",
    },
  ];

  const noProject = !projectsLoading && !selectedProjectId;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-app-border bg-app-bg">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={BriefcaseBusiness}
            title="PM Dashboard"
            subtitle="Track team onboarding, spot recurring questions and keep knowledge gaps visible."
            actions={<PmHeaderStatus />}
          />
        </div>
      </header>

      <div ref={swipeRef} className="app-page-frame flex-1 py-6 pb-24 lg:py-8">
        {noProject ? (
          // One calm state for the whole area instead of six cards each reporting a failed
          // request: without a project there is nothing to ask the backend about.
          <EmptyState icon={<FolderKanban className="h-8 w-8" />} title="No project selected">
            {projects.length === 0
              ? "There are no projects yet. Once one exists, its team and insights show up here."
              : "Pick a project in the sidebar to see its team, escalations and insights."}
          </EmptyState>
        ) : (
          <>
            {/* The project analysis beside the tabs, on the overview only. Hidden rather than
                unmounted on the other sections: it owns the run, so leaving the overview while
                one is going (or opening a finding elsewhere) must not throw it away.
                One row that never wraps, the launcher pinned to its right edge: with `flex-wrap`
                the launcher dropped under the tabs, to the left, whenever the column got narrower
                (a wider sidebar, a smaller window). The tabs give way instead — they scroll
                sideways on their own. */}
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <SegmentedTabs
                  value={section}
                  options={options}
                  onChange={goToSection}
                  layoutId="pm-workspace-section-pill"
                  ariaLabel="PM dashboard sections"
                />
              </div>
              <motion.div
                className={launcherShown ? "flex shrink-0" : "hidden"}
                initial={false}
                animate={{ opacity: launcherShown ? 1 : 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : SLIDING_PANEL_SECONDS }}
              >
                <ProjectAnalysisLauncher
                  onRefreshed={setAnalysisRevision}
                  runRequest={analysisRequest}
                />
              </motion.div>
            </div>

            {/* `-mx-2 px-2` moves the clip edge 8px outside the column without moving the
                content, so focus rings and borders at the column's edge (the team search box,
                say) paint the few pixels they reach past it instead of being cut.
                `overflow-x-clip` keeps the slide inside the column: the incoming section starts
                24px to the side, and without the clip that briefly widened the page and flashed
                a horizontal scrollbar under the header. `clip` rather than `hidden`, which would
                make this a scroll container and break the sticky and fixed elements inside. */}
            <div ref={sectionFrameRef} className="-mx-2 mt-6 overflow-x-clip px-2">
              <SlidingTabPanel activeKey={viewKey} index={PM_SECTION_ORDER.indexOf(section)}>
                {content}
              </SlidingTabPanel>
            </div>
          </>
        )}
      </div>

      <MemberPeekPanel />
    </div>
  );
}
