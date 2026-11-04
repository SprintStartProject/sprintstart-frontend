import { canAccessRoute, type AppRoute } from "../../../auth/accessPolicy";
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
} from "../SidebarNavIcons";

export type SidebarNavItem = {
  label: string;
  path: AppRoute;
  /**
   * A component rather than an element: each icon needs to know when its
   * entry becomes the current route so it can play its animation once.
   */
  icon: SidebarIcon;
};

export type SidebarSection = {
  /** Optional uppercase group label rendered above the entries. */
  heading?: string;
  items: SidebarNavItem[];
};

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

type Profile = Parameters<typeof canAccessRoute>[0];

/**
 * The entries this user may see, grouped under their headings; a group with no entries is left out.
 * The OnBoarding entry is offered only while there is onboarding to do (`useOnboardingAvailable`).
 */
export function buildSections(
  profile: Profile,
  canManageSelected: boolean,
  isOnboardingAvailable: boolean,
): SidebarSection[] {
  const allowed = (items: SidebarNavItem[]) =>
    items.filter((item) => canAccessRoute(profile, item.path, canManageSelected));

  return [
    {
      items: allowed(navItems).filter(
        (item) => item.path !== "/onboarding" || isOnboardingAvailable,
      ),
    },
    { heading: "Project Manager", items: allowed(projectManagerNavItems) },
    { heading: "Admin", items: allowed(adminNavItems) },
  ].filter((section) => section.items.length > 0);
}

/**
 * The pill animates between entries by measuring where the old one sat. That measurement is only
 * meaningful while the list itself holds still — and it does not always. The Project Manager
 * section appears once the project context reports `canManageSelected`, and the OnBoarding entry
 * disappears when a profile refresh reports it complete. Both shift every entry below them by a row.
 *
 * Folding the visible paths into the `layoutId` means a changed list is simply a different shared
 * element: the pill appears where it belongs instead of animating from a position that no longer
 * exists. While the list is stable — which is nearly always — nothing changes.
 */
export function indicatorLayoutIdFor(instanceId: string, sections: SidebarSection[]): string {
  const paths = sections.flatMap((section) => section.items.map((item) => item.path));
  return `sidebar-active-pill-${instanceId}-${paths.join("|")}`;
}
