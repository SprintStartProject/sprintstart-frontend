import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
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
import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { SegmentedTabs, type SegmentedTabOption } from "../../components/ui/SegmentedTabs";
import { SlidingTabPanel } from "../../components/ui/SlidingTabPanel";
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
import { MemberPeekPanel } from "./components/MemberPeekPanel";
import { MEMBER_PEEK_PARAM } from "./useMemberPeek";

export type PmSection = "overview" | "team" | "escalations" | "onboarding" | "questions" | "gaps";

export const PM_SECTION_ORDER: readonly PmSection[] = [
  "overview",
  "team",
  "escalations",
  "onboarding",
  "questions",
  "gaps",
];

/** Where each section lives. The first path is the one the tab bar navigates to. */
export const PM_SECTION_PATHS: Record<PmSection, string> = {
  overview: "/pm-dashboard",
  team: "/team-management",
  escalations: "/insights/knowledge-requests",
  onboarding: "/insights/onboarding",
  questions: "/insights/faq",
  gaps: "/insights/knowledge-gaps",
};

type ResolvedSection = {
  section: PmSection;
  /** Distinguishes views inside one section that should still slide, e.g. two profiles. */
  viewKey: string;
  content: ReactNode;
  /** A side panel of the section's own is open (a question, a gap). */
  hasOwnPanel: boolean;
};

function resolveSection(pathname: string): ResolvedSection {
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
    content: <PmDashboardPage />,
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
  const [searchParams] = useSearchParams();
  const { projects, selectedProjectId, isLoading: projectsLoading } = useProjectContext();
  const openEscalations = useOpenEscalationCount(selectedProjectId, true, pathname);

  const { section, viewKey, content, hasOwnPanel } = resolveSection(pathname);
  const panelOpen = hasOwnPanel || searchParams.has(MEMBER_PEEK_PARAM);

  const goToSection = useCallback(
    (next: PmSection) => {
      if (next === section && pathname === PM_SECTION_PATHS[next]) return;
      void navigate(PM_SECTION_PATHS[next]);
    },
    [navigate, pathname, section],
  );

  // Two-finger horizontal swipe between sections, the gesture every tabbed page answers to.
  // Off while a side panel is open: the panels are fixed on top of this element, so a sideways
  // scroll inside one would otherwise bubble up here and switch the section underneath it.
  const swipeRef = useSwipeableTabs<PmSection, HTMLDivElement>({
    order: PM_SECTION_ORDER,
    value: section,
    onChange: goToSection,
    enabled: !panelOpen,
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
    { value: "team", label: "Team", icon: <Users className="h-4 w-4" /> },
    {
      value: "escalations",
      label: "Escalations",
      icon: <Inbox className="h-4 w-4" />,
      count: openEscalations > 0 ? openEscalations : undefined,
    },
    { value: "onboarding", label: "Onboarding", icon: <Gauge className="h-4 w-4" /> },
    { value: "questions", label: "Questions", icon: <MessageSquareMore className="h-4 w-4" /> },
    { value: "gaps", label: "Knowledge gaps", icon: <ShieldAlert className="h-4 w-4" /> },
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
            <SegmentedTabs
              value={section}
              options={options}
              onChange={goToSection}
              layoutId="pm-workspace-section-pill"
              ariaLabel="PM dashboard sections"
            />

            {/* `overflow-x-clip` keeps the slide inside the column: the incoming section starts
                24px to the side, and without the clip that briefly widened the page and flashed
                a horizontal scrollbar under the header. `clip` rather than `hidden`, which would
                make this a scroll container and break the sticky and fixed elements inside. */}
            <div ref={sectionFrameRef} className="mt-6 overflow-x-clip">
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
