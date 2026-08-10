import { useId, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import { LogOut, Menu, Settings, X } from "lucide-react";
import { UserAvatar } from "../common/UserAvatar";
import { useAuth } from "../../context/useAuth";
import { canAccessRoute, isOnboardingAccessible, type AppRoute } from "../../auth/accessPolicy";
import { ProjectSwitcher } from "../../features/projects/components/ProjectSwitcher";
import { useProjectContext } from "../../features/projects/useProjectContext";
import { usePmAttentionFlag } from "../../features/team-management/usePmAttentionFlag";
import {
  AdminIcon,
  ChatIcon,
  DashboardIcon,
  DataIngestionIcon,
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
};

const navItems: SidebarNavItem[] = [
  {
    label: "Dashboard",
    path: "/",
    icon: DashboardIcon,
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
}: SidebarContentProps) {
  const { profile, logout, status } = useAuth();
  const { canManageSelected } = useProjectContext();
  const location = useLocation();
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
      // Hide onboarding once the user has completed it and been promoted.
      (item.path !== "/onboarding" || isOnboardingAccessible(profile)),
  );
  const visibleProjectManagerNavItems = projectManagerNavItems.filter((item) =>
    canAccessRoute(profile, item.path, canManageSelected),
  );
  const visibleAdminNavItems = adminNavItems.filter((item) =>
    canAccessRoute(profile, item.path, canManageSelected),
  );

  const isPmSectionActive =
    location.pathname.startsWith("/pm-dashboard") ||
    location.pathname.startsWith("/insights/faq") ||
    location.pathname.startsWith("/insights/knowledge-gaps");

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
    <div className="flex h-full flex-col bg-app-bg text-app-text">
      <div className="flex items-center gap-3 px-[24px] py-[24px]">
        <SidebarLogo />

        <h1 className="text-lg leading-none font-bold tracking-tight text-app-text">SprintStart</h1>
      </div>

      <nav
        aria-label={ariaLabel}
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
        className="flex-1 space-y-[5px] px-[24px] py-[20px]"
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
                  forceActive={item.path === "/pm-dashboard" && isPmSectionActive}
                  indicatorLayoutId={indicatorLayoutId}
                  pointerY={pointerY}
                  hasAttentionMarker={item.path === "/pm-dashboard" && hasPmAttentionItems}
                  attentionLabel="Open skip requests or unread feedback"
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
      <div className="px-[12px] pt-[8px] pb-[16px]">
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
                  title="Settings"
                  aria-label="Settings"
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
  const hasPmAttentionItems = usePmAttentionFlag(
    selectedProjectId,
    canAccessRoute(profile, "/pm-dashboard", canManageSelected),
    pathname,
  );

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <>
      <aside
        aria-label="Desktop Sidebar"
        className="sticky top-0 hidden h-screen w-[286px] shrink-0 flex-col border-r border-app-border bg-app-bg lg:flex"
      >
        <SidebarContent aria-label="Desktop Navigation" hasPmAttentionItems={hasPmAttentionItems} />
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
          onClick={() => setIsMobileSidebarOpen((isOpen) => !isOpen)}
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
          "fixed top-0 bottom-0 left-0 z-[60] flex w-[286px] flex-col border-r border-app-border bg-app-bg transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <SidebarContent
          aria-label="Mobile Navigation"
          onNavigate={closeMobileSidebar}
          hasPmAttentionItems={hasPmAttentionItems}
        />
      </aside>
    </>
  );
}
