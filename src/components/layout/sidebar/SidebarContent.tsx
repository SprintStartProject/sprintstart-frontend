import { useLocation } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import { useProjectContext } from "../../../features/projects/useProjectContext";
import { useOnboardingAvailable } from "../../../features/onboarding/hooks/useOnboardingAvailable";
import { SidebarLogo } from "../SidebarLogo";
import { isPmSectionActive, type PmDashboardBadge } from "./pmBadge";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarNav } from "./SidebarNav";
import { buildSections } from "./sidebarSections";

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

/** Logo and name; the logo's press folds the desktop sidebar or closes the drawer. */
function SidebarHeader({
  collapsed,
  onNavigate,
  onToggleCollapsed,
}: Pick<SidebarContentProps, "onNavigate" | "onToggleCollapsed"> & { collapsed: boolean }) {
  return (
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
  );
}

/**
 * Renders the navigation links and user profile section within the sidebar.
 */
export function SidebarContent({
  onNavigate,
  "aria-label": ariaLabel = "Primary Navigation",
  hasPmAttentionItems = false,
  pmBadge = null,
  unseenSkipAnswerCount = 0,
  collapsed = false,
  onToggleCollapsed,
}: SidebarContentProps) {
  const { profile } = useAuth();
  const { canManageSelected } = useProjectContext();
  const isOnboardingAvailable = useOnboardingAvailable();
  const { pathname } = useLocation();
  const sections = buildSections(profile, canManageSelected, isOnboardingAvailable);

  return (
    <div className="flex h-full min-h-0 flex-col bg-app-bg text-app-text">
      <SidebarHeader
        collapsed={collapsed}
        onNavigate={onNavigate}
        onToggleCollapsed={onToggleCollapsed}
      />

      <SidebarNav
        sections={sections}
        ariaLabel={ariaLabel}
        hasPmAttentionItems={hasPmAttentionItems}
        pmBadge={pmBadge}
        unseenSkipAnswerCount={unseenSkipAnswerCount}
        isPmSectionActive={isPmSectionActive(pathname)}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />

      <SidebarFooter collapsed={collapsed} onNavigate={onNavigate} />
    </div>
  );
}
