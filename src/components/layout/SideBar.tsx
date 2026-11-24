import { useLayoutEffect } from "react";
import { Menu, X } from "lucide-react";
import { SidebarContent } from "./sidebar/SidebarContent";
import { useMobileDrawer } from "./sidebar/useMobileDrawer";
import { useSidebarBadges } from "./sidebar/useSidebarBadges";
import { SidebarLogo } from "./SidebarLogo";
import { SidebarResizeHandle } from "./SidebarResizeHandle";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH_VAR, useSidebarLayout } from "./useSidebarLayout";

/**
 * Publishes the desktop sidebar's width on the root, where the page's own margin reads it too. Set
 * before paint, so a folded sidebar never shows at full width for a frame on load.
 */
function useSidebarWidthVar(width: number): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(SIDEBAR_WIDTH_VAR, `${width}px`);
    return () => {
      root.style.removeProperty(SIDEBAR_WIDTH_VAR);
    };
  }, [width]);
}

type MobileHeaderProps = {
  isOpen: boolean;
  onToggle: () => void;
};

function MobileHeader({ isOpen, onToggle }: MobileHeaderProps) {
  return (
    <header className="fixed top-0 right-0 left-0 z-40 flex h-[64px] items-center justify-between border-b border-app-border bg-app-bg px-[16px] lg:hidden">
      <div className="flex items-center gap-3">
        {/* Opens and closes the drawer like the menu button beside it, as the desktop logo
            folds the sidebar. "Collapsed" is the drawer being shut. */}
        <SidebarLogo
          sidebarToggle={{
            collapsed: !isOpen,
            onToggle,
            kind: "drawer",
          }}
        />

        <span className="text-base leading-none font-bold tracking-tight text-app-text">
          SprintStart
        </span>
      </div>

      <button
        type="button"
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex h-[40px] w-[40px] items-center justify-center rounded-[8px] text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
      >
        {isOpen ? <X className="h-[22px] w-[22px]" /> : <Menu className="h-[22px] w-[22px]" />}
      </button>
    </header>
  );
}

/**
 * Main application sidebar for navigation.
 * Handles both the desktop sticky sidebar and the mobile slide-out menu.
 */
export function SideBar() {
  const badges = useSidebarBadges();

  // The desktop sidebar's width and folded state, remembered across visits. The mobile drawer
  // does not use either: it keeps its fixed width and opens over the page.
  const sidebarLayout = useSidebarLayout();
  useSidebarWidthVar(sidebarLayout.collapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarLayout.width);
  const [drawerRef, drawer] = useMobileDrawer(sidebarLayout.toggleCollapsed);

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
          {...badges}
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

      <MobileHeader isOpen={drawer.isOpen} onToggle={drawer.toggle} />

      {drawer.isOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={drawer.close}
          className="fixed inset-0 z-50 bg-app-overlay backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        ref={drawerRef}
        tabIndex={-1}
        aria-label="Mobile Sidebar"
        aria-hidden={!drawer.isOpen}
        inert={!drawer.isOpen}
        className={[
          // The cubic-bezier is the iOS sheet curve: fast out of the
          // gate, long soft settle — reads as gliding, not snapping.
          "fixed top-0 bottom-0 left-0 z-[60] flex w-[var(--app-sidebar-width)] flex-col border-r border-app-border bg-app-bg outline-hidden transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden",
          drawer.isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <SidebarContent
          aria-label="Mobile Navigation"
          onNavigate={drawer.close}
          onToggleCollapsed={drawer.close}
          {...badges}
        />
      </aside>
    </>
  );
}
