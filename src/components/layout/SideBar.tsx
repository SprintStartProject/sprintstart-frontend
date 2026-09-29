import { useCallback, useEffect, useId, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import { LogOut, Menu, Settings, X } from "lucide-react";
import { UserAvatar } from "../common/UserAvatar";
import { useAuth } from "../../context/useAuth";
import { canAccessRoute, isOnboardingAccessible, type AppRoute } from "../../auth/accessPolicy";
import { ProjectSwitcher } from "../../features/projects/components/ProjectSwitcher";
import { useProjectContext } from "../../features/projects/useProjectContext";
import { useOnboardingAvailable } from "../../features/onboarding/hooks/useOnboardingAvailable";
import { useOnboardingJourney } from "../../features/onboarding/generation/OnboardingJourneyContext";
import { useMyKnowledgeGaps } from "../../features/knowledge-gaps/useMyKnowledgeGaps";
import { usePmAttentionCount } from "../../features/team-management/usePmAttentionCount";
import { useKnownOpenEscalationCount } from "../../features/knowledge-request/useOpenEscalationCount";
import { useUnseenSkipAnswerCount } from "../../features/onboarding/hooks/useUnseenSkipAnswerCount";
import {
  SIDEBAR_TOGGLE_SHORTCUT,
  navigationShortcut,
  useShortcutListener,
} from "../../features/shortcuts";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import {
  AdminIcon,
  BlueprintsIcon,
  BoardIcon,
  ChatIcon,
  DashboardIcon,
  DataIngestionIcon,
  HireSetupIcon,
  KnowledgeBaseIcon,
  OnboardingIcon,
  PmDashboardIcon,
  type SidebarIcon,
} from "./SidebarNavIcons";
import { SidebarLogo } from "./SidebarLogo";
import { SidebarNavLink } from "./SidebarNavLink";
import { hoverSpringToken } from "../../styles/tokens";

type SidebarNavItem = {
  label: string;
  path: AppRoute;
  /**
   * A component rather than an element: each icon needs to know when its
   * entry becomes the current route so it can play its animation once.
   */
  icon: SidebarIcon;
};

type SidebarContentProps = {
  onNavigate?: () => void;
  "aria-label"?: string;
  /**
   * Passed in rather than fetched here: this component is mounted twice at
   * once (desktop and mobile), so owning the request would fire it twice.
   */
  hasPmAttentionItems?: boolean;
  /**
   * The number on the PM Dashboard entry and what it stands for, or `null` while any part of it
   * is still loading or failed to load -- see {@link pmDashboardBadge}. Passed in for the same
   * reason as the flag above: this component is mounted twice at once.
   */
  pmBadge?: PmDashboardBadge | null;
  /** Skip requests the project manager answered that the member has not looked at yet. */
  unseenSkipAnswerCount?: number;
};

/**
 * The escalation inbox's route. It has no entry of its own any more -- it is a section of the PM
 * dashboard -- but the access check that decides whether to read the open count is still the
 * inbox's own, and the count now rides on the PM dashboard's entry.
 */
const ESCALATION_INBOX_PATH = "/insights/knowledge-requests" as const;

type PmDashboardBadge = {
  count: number;
  /** What the number counts, for a screen reader: the total and its parts. */
  label: string;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The number on the PM Dashboard entry: pending skip requests, unread onboarding feedback and
 * open escalations, added up.
 *
 * `null` unless every part is known. A part still loading or whose read failed would otherwise
 * count as nothing and quietly shrink the total -- a smaller number that looks just as sure of
 * itself as the right one. Escalations are part of it because the entry already carried their
 * count, and a second number beside the first would have to explain which is which.
 *
 * Handed only to the PM dashboard entry: a future counted entry inheriting the label would
 * announce its own total as skip requests and feedback.
 */
function pmDashboardBadge(
  attention: { pendingSkips: number; unreadFeedback: number } | null,
  openEscalations: number | null,
): PmDashboardBadge | null {
  if (attention === null || openEscalations === null) return null;

  const count = attention.pendingSkips + attention.unreadFeedback + openEscalations;
  const parts = [
    attention.pendingSkips > 0 &&
      plural(attention.pendingSkips, "pending skip request", "pending skip requests"),
    attention.unreadFeedback > 0 &&
      plural(attention.unreadFeedback, "unread feedback", "unread feedback items"),
    openEscalations > 0 && plural(openEscalations, "open escalation", "open escalations"),
  ].filter(Boolean);

  return {
    count,
    label: `${plural(count, "item needs", "items need")} your attention: ${parts.join(", ")}`,
  };
}

const navItems: SidebarNavItem[] = [
  {
    label: "Dashboard",
    path: "/",
    icon: DashboardIcon,
  },
  // Directly under the dashboard: the board is where the hire's own onboarding
  // sits between conversations, so it belongs beside the overview rather than
  // buried behind the chat that fills it.
  {
    label: "Board",
    path: "/board",
    icon: BoardIcon,
  },
  {
    label: "Chat",
    path: "/chat",
    icon: ChatIcon,
  },
  {
    label: "Knowledge Base",
    path: "/knowledge-base",
    icon: KnowledgeBaseIcon,
  },
  {
    label: "OnBoarding",
    path: "/onboarding",
    icon: OnboardingIcon,
  },
];

const projectManagerNavItems: SidebarNavItem[] = [
  {
    label: "PM Dashboard",
    path: "/pm-dashboard",
    icon: PmDashboardIcon,
  },
  {
    label: "Data Ingestion",
    path: "/data-ingestion",
    icon: DataIngestionIcon,
  },
  // After the material it is written from. A blueprint is authored against what
  // the project has already told the system about itself, so a PM setting one up
  // for the first time meets the two in the order they are done in.
  {
    label: "Blueprints",
    path: "/blueprints",
    icon: BlueprintsIcon,
  },
  // Arrival authoring and Starter Work review, as tabs of one page — set up here by the PM,
  // which is why it sits with the other things a PM prepares rather than in the hire's own list.
  // `canAccessRoute` keeps it off a hire's sidebar.
  {
    label: "Hire Setup",
    path: "/hire-setup",
    icon: HireSetupIcon,
  },
];

const adminNavItems: SidebarNavItem[] = [
  {
    label: "Access Management",
    path: "/admin",
    icon: AdminIcon,
  },
];

type SidebarSection = {
  /** Optional uppercase group label rendered above the entries. */
  heading?: string;
  items: SidebarNavItem[];
};

/**
 * Renders the navigation links and user profile section within the sidebar.
 */
function SidebarContent({
  onNavigate,
  "aria-label": ariaLabel = "Primary Navigation",
  hasPmAttentionItems = false,
  pmBadge = null,
  unseenSkipAnswerCount = 0,
}: SidebarContentProps) {
  const { profile, logout, status } = useAuth();
  const { canManageSelected } = useProjectContext();
  const isOnboardingAvailable = useOnboardingAvailable();
  const { generation } = useOnboardingJourney();
  const location = useLocation();
  /*
    Components put in this user's name that they have not acknowledged yet. Read straight from
    the shared provider rather than passed down like `hasPmAttentionItems`: that one is passed
    because owning the request here would fire it twice over (this renders once for desktop and
    once for the mobile drawer), and the provider already solves exactly that.
  */
  const { unseenComponents } = useMyKnowledgeGaps();
  const hasUnseenKnowledgeGaps = unseenComponents.length > 0;
  /**
   * Viewport y of the pointer while it is over the nav, `-Infinity` when it
   * is not. A motion value rather than state: it changes on every pointer
   * move, and re-rendering the whole sidebar that often to animate a
   * transform would be paying React for something the compositor can do.
   */
  const pointerY = useMotionValue(Number.NEGATIVE_INFINITY);
  // Scopes the sliding pill to this sidebar instance. The desktop and the
  // mobile sidebar are mounted at the same time and must not share one
  // `layoutId`, otherwise Framer Motion animates the pill between them.
  const instanceId = useId();

  const visibleNavItems = navItems.filter(
    (item) =>
      canAccessRoute(profile, item.path, canManageSelected) &&
      // Offered while there is onboarding to do -- see `useOnboardingAvailable`.
      (item.path !== "/onboarding" || isOnboardingAvailable),
  );
  const visibleProjectManagerNavItems = projectManagerNavItems.filter((item) =>
    canAccessRoute(profile, item.path, canManageSelected),
  );
  const visibleAdminNavItems = adminNavItems.filter((item) =>
    canAccessRoute(profile, item.path, canManageSelected),
  );

  // The icon-only footer button has no room for a chip, so its name carries the chord — in
  // both attributes, because `aria-label` wins the accessible-name computation and a `title`
  // alone would reach the mouse tooltip only.
  const settingsShortcut = navigationShortcut("/settings");
  const settingsLabel = settingsShortcut ? `Settings (${settingsShortcut})` : "Settings";

  /**
   * The buddy is the other half of the chat's page, not a page of its own: one header, one
   * switch, two conversations. So the entry that leads there lights up for both — without it
   * the sidebar claimed the hire was nowhere at all while they were looking at half of Chat.
   */
  const isAssistantSectionActive = location.pathname.startsWith("/buddy");

  /**
   * Team management and a member's detail page are reached from the PM dashboard and have no
   * entry of their own, so the dashboard's entry stands in for them the same way it does for
   * the insights pages -- otherwise the sidebar claims the PM is nowhere while they are
   * looking at their own team. `/team/` is the member detail route, which `accessPolicy`
   * already treats as a prefix of `/team-management`.
   */
  const isPmSectionActive =
    location.pathname.startsWith("/pm-dashboard") ||
    location.pathname.startsWith("/team-management") ||
    location.pathname.startsWith("/team/") ||
    location.pathname.startsWith("/insights/faq") ||
    location.pathname.startsWith("/insights/knowledge-gaps") ||
    location.pathname.startsWith("/insights/onboarding") ||
    location.pathname.startsWith(ESCALATION_INBOX_PATH);

  const sections: SidebarSection[] = [
    { items: visibleNavItems },
    { heading: "Project Manager", items: visibleProjectManagerNavItems },
    { heading: "Admin", items: visibleAdminNavItems },
  ].filter((section) => section.items.length > 0);

  /**
   * The pill animates between entries by measuring where the old one sat.
   * That measurement is only meaningful while the list itself holds still --
   * and it does not always. The Project Manager section appears once the
   * project context reports `canManageSelected`, and the OnBoarding entry
   * disappears when a profile refresh reports it complete. Both shift every
   * entry below them by a row.
   *
   * Navigating in that window left the pill measuring against the old layout
   * and flying in from the wrong side. Folding the visible paths into the
   * `layoutId` means a changed list is simply a different shared element:
   * the pill appears where it belongs instead of animating from a position
   * that no longer exists. While the list is stable -- which is nearly
   * always -- nothing changes.
   */
  const indicatorLayoutId = `sidebar-active-pill-${instanceId}-${sections
    .flatMap((section) => section.items.map((item) => item.path))
    .join("|")}`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-app-bg text-app-text">
      <div className="flex shrink-0 items-center gap-3 px-[24px] py-[24px]">
        <SidebarLogo />

        <h1 className="text-lg leading-none font-bold tracking-tight text-app-text">SprintStart</h1>
      </div>

      <nav
        aria-label={ariaLabel}
        // Marks this element as the scroll container the nav rows re-measure
        // against — see the scroll listener in `SidebarNavLink`.
        data-sidebar-scroll="true"
        // Tracked on the nav, not per entry: pointer enter/leave on the
        // individual rows is skipped outright when the mouse crosses
        // several of them inside one frame.
        onPointerMove={(event) => pointerY.set(event.clientY)}
        onPointerLeave={() => pointerY.set(Number.NEGATIVE_INFINITY)}
        // 24px inner padding. This and DOCK_HOVER_SCALE trade directly
        // against each other: the item grows rightwards from a fixed
        // left edge, so 286px sidebar - 2x24 = 238px wide, x1.06 = 252px,
        // finishing ~10px short of the border. Pulling the content
        // further left again would need a smaller scale to keep that
        // gap. Header and footer share the inset, so everything lines
        // up on one left edge.
        className="app-scrollbar min-h-0 flex-1 space-y-[5px] overflow-x-hidden overflow-y-auto px-[24px] py-[20px]"
      >
        {sections.map((section, sectionIndex) => (
          <div
            key={section.heading ?? "primary"}
            className={sectionIndex > 0 ? "pt-[20px]" : undefined}
          >
            {section.heading ? (
              <p className="px-[12px] pb-[8px] text-[10px] font-semibold tracking-[0.18em] text-app-text-muted uppercase">
                {section.heading}
              </p>
            ) : null}

            <div className="space-y-[5px]">
              {section.items.map((item) => (
                <SidebarNavLink
                  key={item.path}
                  to={item.path}
                  label={item.label}
                  icon={item.icon}
                  end={item.path === "/"}
                  forceActive={
                    (item.path === "/pm-dashboard" && isPmSectionActive) ||
                    (item.path === "/chat" && isAssistantSectionActive)
                  }
                  shortcut={navigationShortcut(item.path)}
                  indicatorLayoutId={indicatorLayoutId}
                  pointerY={pointerY}
                  hasAttentionMarker={
                    (item.path === "/pm-dashboard" && hasPmAttentionItems) ||
                    (item.path === "/" && hasUnseenKnowledgeGaps) ||
                    (item.path === "/onboarding" && unseenSkipAnswerCount > 0)
                  }
                  attentionLabel={
                    item.path === "/"
                      ? "A component has been assigned to you"
                      : item.path === "/onboarding"
                        ? "Your project manager answered a skip request"
                        : "Open skip requests, unread feedback or escalations"
                  }
                  count={item.path === "/pm-dashboard" ? (pmBadge?.count ?? 0) : 0}
                  busy={item.path === "/onboarding" && generation.status === "running"}
                  busyLabel="Your onboarding path is being built"
                  countLabel={
                    item.path === "/pm-dashboard" && pmBadge ? () => pmBadge.label : undefined
                  }
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Floating glass card instead of a full-bleed bar. The 12px outer
                gutter plus 12px inner padding lines its content up with the
                24px inset used by the nav items above. */}
      <div className="shrink-0 px-[12px] pt-[8px] pb-[16px]">
        <div className="space-y-[12px] rounded-[18px] border border-app-border/70 bg-app-surface/70 p-[12px] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          {profile && (
            <div className="flex items-center justify-between gap-2 py-[2px]">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-surface-muted">
                  <UserAvatar
                    size={32}
                    profileIcon={profile.profileIcon}
                    fallbackName={`${profile.firstName} ${profile.lastName}`.trim()}
                    seed={profile.id}
                  />
                </div>

                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-sm font-semibold text-app-text">
                    {profile.username}
                  </span>

                  <span className="truncate text-[10px] font-medium tracking-wider text-app-text-muted uppercase">
                    {profile.permissionGroup.replace("_", " ")}
                  </span>
                </div>
              </div>
              <motion.div
                whileHover={{ scale: 1.18 }}
                whileTap={{ scale: 0.92 }}
                transition={hoverSpringToken}
                className="shrink-0"
              >
                <NavLink
                  to="/settings"
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors ${
                      isActive
                        ? "bg-app-brand-soft text-app-brand"
                        : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                    }`
                  }
                  title={settingsLabel}
                  aria-label={settingsLabel}
                >
                  <Settings className="h-[18px] w-[18px]" />
                </NavLink>
              </motion.div>
            </div>
          )}

          <ProjectSwitcher className="w-full" />

          <motion.button
            type="button"
            onClick={() => {
              void logout();
            }}
            disabled={status === "loading"}
            whileHover={status === "loading" ? undefined : { scale: 1.02 }}
            whileTap={status === "loading" ? undefined : { scale: 0.98 }}
            transition={hoverSpringToken}
            className="flex h-[40px] w-full items-center justify-center gap-[12px] rounded-[12px] border border-app-danger-border/40 bg-app-danger-bg/70 text-sm font-medium text-app-danger-text backdrop-blur-md transition-colors hover:border-app-danger-solid hover:bg-app-danger-solid hover:text-white focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="h-[16px] w-[16px]" />
            Logout
          </motion.button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main application sidebar for navigation.
 * Handles both the desktop sticky sidebar and the mobile slide-out menu.
 */
export function SideBar() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { profile } = useAuth();
  const { canManageSelected, selectedProjectId } = useProjectContext();
  const { pathname } = useLocation();

  // Owned here, not in `SidebarContent`: that renders twice at once, once for
  // desktop and once for the mobile drawer. Fetching inside it meant every
  // page load and every project switch fired the request twice over.
  //
  // Passing the route as the refresh key rechecks on every view change; the
  // hook rate-limits that so quick navigation cannot hammer the backend.
  // Gated on access so a regular member never pays for a request they could
  // not act on anyway.
  const pmAttention = usePmAttentionCount(
    selectedProjectId,
    canAccessRoute(profile, "/pm-dashboard", canManageSelected),
    pathname,
  );

  // Its own read: escalations are not onboarding items and have their own count endpoint. Gated
  // on the inbox route rather than the dashboard -- for a PM it additionally requires managing
  // the selected project, so a PM who is only a member of it neither pays for the request nor
  // sees it counted. `null` while loading or failed, 0 when there is nothing of it to count.
  const openEscalations = useKnownOpenEscalationCount(
    selectedProjectId,
    canAccessRoute(profile, ESCALATION_INBOX_PATH, canManageSelected),
    pathname,
  );

  const pmBadge = pmDashboardBadge(pmAttention, openEscalations);
  // While part of the number is unknown the entry shows no number, only the marker -- and only if
  // a part that is known has something in it. Better "something is waiting" than a wrong count.
  const hasPmAttentionItems =
    pmBadge === null && ((pmAttention?.total ?? 0) > 0 || (openEscalations ?? 0) > 0);

  // Owned here for the same reason: read once, handed to both sidebars.
  const { availability } = useOnboardingJourney();
  const unseenSkipAnswerCount = useUnseenSkipAnswerCount(
    profile?.id,
    isOnboardingAccessible(profile) && availability === "path",
    pathname,
  );

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  // A chord can change the route without any link being clicked (Alt+H — nothing runs
  // `onNavigate` then), and the drawer would still be standing open over the new page.
  // Deferred to a microtask so this is not a synchronous setState inside the effect body,
  // which `react-hooks/set-state-in-effect` rejects.
  useEffect(() => {
    void Promise.resolve().then(() => setIsMobileSidebarOpen(false));
  }, [pathname]);

  /**
   * Alt+S works whatever the header's button works — one definition of "toggle the sidebar"
   * for both ways in. Today that is the drawer below `lg`; the desktop collapse (#244) will
   * give the same chord something to do on a wide screen without this line changing.
   *
   * Which is exactly why it only listens below `lg`: on a wide screen the drawer is not on
   * screen, so the chord would flip state nobody can see — and leave it flipped, opening the
   * drawer uninvited the next time the window narrows. Worse, `Alt+S` is Firefox's History
   * menu on Windows, and swallowing it for a no-op takes the browser's own chord too.
   */
  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((isOpen) => !isOpen);
  }, []);
  const isDesktopLayout = useMediaQuery("(min-width: 1024px)");

  useShortcutListener(SIDEBAR_TOGGLE_SHORTCUT, toggleMobileSidebar, !isDesktopLayout);

  return (
    <>
      <aside
        aria-label="Desktop Sidebar"
        className="fixed top-0 bottom-0 left-0 hidden w-[var(--app-sidebar-width)] flex-col border-r border-app-border bg-app-bg lg:flex"
      >
        <SidebarContent
          aria-label="Desktop Navigation"
          hasPmAttentionItems={hasPmAttentionItems}
          pmBadge={pmBadge}
          unseenSkipAnswerCount={unseenSkipAnswerCount}
        />
      </aside>

      <header className="fixed top-0 right-0 left-0 z-40 flex h-[64px] items-center justify-between border-b border-app-border bg-app-bg px-[16px] lg:hidden">
        <div className="flex items-center gap-3">
          <SidebarLogo />

          <span className="text-[16px] leading-none font-bold tracking-tight text-app-text">
            SprintStart
          </span>
        </div>

        <button
          type="button"
          aria-label={isMobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={isMobileSidebarOpen}
          onClick={toggleMobileSidebar}
          className="flex h-[40px] w-[40px] items-center justify-center rounded-[8px] text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          {isMobileSidebarOpen ? (
            <X className="h-[22px] w-[22px]" />
          ) : (
            <Menu className="h-[22px] w-[22px]" />
          )}
        </button>
      </header>

      {isMobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-50 bg-app-overlay backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        aria-label="Mobile Sidebar"
        aria-hidden={!isMobileSidebarOpen}
        inert={!isMobileSidebarOpen}
        className={[
          // The cubic-bezier is the iOS sheet curve: fast out of the
          // gate, long soft settle — reads as gliding, not snapping.
          "fixed top-0 bottom-0 left-0 z-[60] flex w-[var(--app-sidebar-width)] flex-col border-r border-app-border bg-app-bg transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <SidebarContent
          aria-label="Mobile Navigation"
          onNavigate={closeMobileSidebar}
          hasPmAttentionItems={hasPmAttentionItems}
          pmBadge={pmBadge}
          unseenSkipAnswerCount={unseenSkipAnswerCount}
        />
      </aside>
    </>
  );
}
