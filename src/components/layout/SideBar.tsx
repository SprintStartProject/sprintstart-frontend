import { useCallback, useEffect, useId, useLayoutEffect, useState } from "react";
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
import { useDialogFocus } from "../ui/useDialogFocus";
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
import { SidebarResizeHandle } from "./SidebarResizeHandle";
import { SidebarAccountFlyout } from "./SidebarAccountFlyout";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH_VAR, useSidebarLayout } from "./useSidebarLayout";
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
  /** Folded to icons -- the desktop sidebar only; the mobile drawer is always full width. */
  collapsed?: boolean;
  /**
   * What a press on the logo does: folds and unfolds the desktop sidebar, and closes the mobile
   * drawer -- the same gesture on both, so the logo never means something on one screen size and
   * nothing on the other.
   */
  onToggleCollapsed?: () => void;
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
    label: "Buddy",
    path: "/buddy",
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
  collapsed = false,
  onToggleCollapsed,
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

  /** The footer card, the same in the open sidebar and in the folded rail's flyout. */
  const footerCard = (
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

              <span className="truncate text-2xs font-medium tracking-wider text-app-text-muted uppercase">
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
        className="flex h-[40px] w-full items-center justify-center gap-[12px] rounded-[12px] border border-app-danger-border/40 bg-app-danger-bg/70 text-sm font-medium text-app-danger-text backdrop-blur-md transition-colors hover:border-app-danger-solid hover:bg-app-danger-solid hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <LogOut aria-hidden="true" className="h-[16px] w-[16px]" />
        Logout
      </motion.button>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-app-bg text-app-text">
      <div
        className={`flex shrink-0 items-center gap-3 py-[24px] ${
          collapsed ? "justify-center px-0" : "px-[24px]"
        }`}
      >
        <SidebarLogo
          sidebarToggle={
            onToggleCollapsed
              ? {
                  collapsed,
                  onToggle: onToggleCollapsed,
                  // Only the desktop sidebar folds; the drawer's own logo closes the drawer.
                  kind: onNavigate ? "drawer" : "fold",
                }
              : undefined
          }
        />

        <h1
          className={
            collapsed ? "sr-only" : "text-lg leading-none font-bold tracking-tight text-app-text"
          }
        >
          SprintStart
        </h1>
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
        // left edge, so at the default 286px sidebar - 2x24 = 238px wide, x1.06 = 252px,
        // finishing ~10px short of the border. Pulling the content
        // further left again would need a smaller scale to keep that
        // gap. Header and footer share the inset, so everything lines
        // up on one left edge.
        // Folded to icons the inset shrinks to 16px, which leaves each 44px row centred.
        className={`app-scrollbar min-h-0 flex-1 space-y-[5px] overflow-x-hidden overflow-y-auto py-[20px] ${
          collapsed ? "px-[16px]" : "px-[24px]"
        }`}
      >
        {sections.map((section, sectionIndex) => (
          <div
            key={section.heading ?? "primary"}
            className={sectionIndex > 0 ? "pt-[20px]" : undefined}
          >
            {section.heading ? (
              collapsed ? (
                // No room for the words: a short rule marks where the group starts, and the
                // heading stays for assistive technology.
                <>
                  <p className="sr-only">{section.heading}</p>
                  <span
                    aria-hidden="true"
                    className="mx-auto mb-[12px] block h-px w-6 bg-app-border"
                  />
                </>
              ) : (
                <p className="px-[12px] pb-[8px] text-2xs font-semibold tracking-[0.18em] text-app-text-muted uppercase">
                  {section.heading}
                </p>
              )
            ) : null}

            <div className="space-y-[5px]">
              {section.items.map((item) => (
                <SidebarNavLink
                  key={item.path}
                  to={item.path}
                  label={item.label}
                  icon={item.icon}
                  end={item.path === "/"}
                  forceActive={item.path === "/pm-dashboard" && isPmSectionActive}
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
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Floating glass card instead of a full-bleed bar. The 12px outer
                gutter plus 12px inner padding lines its content up with the
                24px inset used by the nav items above. Folded, the card slides
                out from the avatar instead of being squeezed into the rail. */}
      {collapsed ? (
        <div className="flex shrink-0 justify-center pt-[8px] pb-[16px]">
          <SidebarAccountFlyout
            label="Account and project"
            trigger={
              profile ? (
                <UserAvatar
                  size={32}
                  profileIcon={profile.profileIcon}
                  fallbackName={`${profile.firstName} ${profile.lastName}`.trim()}
                  seed={profile.id}
                />
              ) : (
                <Settings aria-hidden="true" className="h-[18px] w-[18px] text-app-text-muted" />
              )
            }
          >
            {footerCard}
          </SidebarAccountFlyout>
        </div>
      ) : (
        <div className="shrink-0 px-[12px] pt-[8px] pb-[16px]">{footerCard}</div>
      )}
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

  // The desktop sidebar's width and folded state, remembered across visits. The mobile drawer
  // does not use either: it keeps its fixed width and opens over the page.
  const sidebarLayout = useSidebarLayout();
  const desktopWidth = sidebarLayout.collapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarLayout.width;
  // On the root, where the page's own margin reads it too. Set before paint, so a folded sidebar
  // never shows at full width for a frame on load.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(SIDEBAR_WIDTH_VAR, `${desktopWidth}px`);
    return () => {
      root.style.removeProperty(SIDEBAR_WIDTH_VAR);
    };
  }, [desktopWidth]);

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
   * Alt+S toggles whichever sidebar is on screen: below `lg` the drawer, as the header's
   * button does; from `lg` up the desktop sidebar's fold to icons, as its logo does (#244).
   *
   * Never the drawer on a wide screen: it is not on screen there, so the chord would flip
   * state nobody can see -- and leave it flipped, opening the drawer uninvited the next time
   * the window narrows.
   */
  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((isOpen) => !isOpen);
  }, []);
  const isDesktopLayout = useMediaQuery("(min-width: 1024px)");

  // The drawer is a modal layer over the page: focus moves into it, Tab stays inside, Escape shuts
  // it and focus goes back to the button that opened it. Only while it is actually on screen -- a
  // flag left set after the window grew past `lg` must not trap a keyboard behind a hidden panel.
  const mobileDrawerRef = useDialogFocus<HTMLElement>(
    isMobileSidebarOpen && !isDesktopLayout,
    closeMobileSidebar,
  );

  useShortcutListener(
    SIDEBAR_TOGGLE_SHORTCUT,
    isDesktopLayout ? sidebarLayout.toggleCollapsed : toggleMobileSidebar,
  );

  return (
    <>
      <aside
        aria-label="Desktop Sidebar"
        // Fixed from `lg` up and out of the page's flow (the page leaves its width free, see
        // App), so the width lives in a CSS variable both read. It eases when the sidebar folds
        // and follows the pointer exactly while the edge is dragged (`app-sidebar-eases`).
        className="app-sidebar-eases fixed top-0 bottom-0 left-0 hidden w-[var(--app-sidebar-desktop-width,var(--app-sidebar-width))] flex-col border-r border-app-border bg-app-bg lg:flex"
      >
        <SidebarContent
          aria-label="Desktop Navigation"
          hasPmAttentionItems={hasPmAttentionItems}
          pmBadge={pmBadge}
          unseenSkipAnswerCount={unseenSkipAnswerCount}
          collapsed={sidebarLayout.collapsed}
          onToggleCollapsed={sidebarLayout.toggleCollapsed}
        />
        {/* Also on the folded rail: its edge pulls the sidebar open again. */}
        <SidebarResizeHandle
          width={sidebarLayout.width}
          collapsed={sidebarLayout.collapsed}
          onResize={sidebarLayout.setWidth}
          onCollapse={() => sidebarLayout.setCollapsed(true)}
          onExpand={() => sidebarLayout.setCollapsed(false)}
        />
      </aside>

      <header className="fixed top-0 right-0 left-0 z-40 flex h-[64px] items-center justify-between border-b border-app-border bg-app-bg px-[16px] lg:hidden">
        <div className="flex items-center gap-3">
          {/* Opens and closes the drawer like the menu button beside it, as the desktop logo
              folds the sidebar. "Collapsed" is the drawer being shut. */}
          <SidebarLogo
            sidebarToggle={{
              collapsed: !isMobileSidebarOpen,
              onToggle: toggleMobileSidebar,
              kind: "drawer",
            }}
          />

          <span className="text-base leading-none font-bold tracking-tight text-app-text">
            SprintStart
          </span>
        </div>

        <button
          type="button"
          aria-label={isMobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={isMobileSidebarOpen}
          onClick={toggleMobileSidebar}
          className="flex h-[40px] w-[40px] items-center justify-center rounded-[8px] text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
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
        ref={mobileDrawerRef}
        tabIndex={-1}
        aria-label="Mobile Sidebar"
        aria-hidden={!isMobileSidebarOpen}
        inert={!isMobileSidebarOpen}
        className={[
          // The cubic-bezier is the iOS sheet curve: fast out of the
          // gate, long soft settle — reads as gliding, not snapping.
          "fixed top-0 bottom-0 left-0 z-[60] flex w-[var(--app-sidebar-width)] flex-col border-r border-app-border bg-app-bg outline-hidden transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <SidebarContent
          aria-label="Mobile Navigation"
          onNavigate={closeMobileSidebar}
          onToggleCollapsed={closeMobileSidebar}
          hasPmAttentionItems={hasPmAttentionItems}
          pmBadge={pmBadge}
          unseenSkipAnswerCount={unseenSkipAnswerCount}
        />
      </aside>
    </>
  );
}
