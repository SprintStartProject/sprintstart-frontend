import { useId } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";
import { useOnboardingJourney } from "../../../features/onboarding/generation/OnboardingJourneyContext";
import { useMyKnowledgeGaps } from "../../../features/knowledge-gaps/useMyKnowledgeGaps";
import { navigationShortcut } from "../../../features/shortcuts";
import { SidebarNavLink } from "../SidebarNavLink";
import { navItemState } from "./navItemState";
import type { PmDashboardBadge } from "./pmBadge";
import { indicatorLayoutIdFor, type SidebarSection } from "./sidebarSections";

type SidebarNavProps = {
  sections: SidebarSection[];
  ariaLabel: string;
  hasPmAttentionItems: boolean;
  pmBadge: PmDashboardBadge | null;
  unseenSkipAnswerCount: number;
  isPmSectionActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
};

function SectionHeading({ heading, collapsed }: { heading: string; collapsed: boolean }) {
  if (!collapsed) {
    return (
      <p className="px-[12px] pb-[8px] text-2xs font-semibold tracking-[0.18em] text-app-text-muted uppercase">
        {heading}
      </p>
    );
  }
  // No room for the words: a short rule marks where the group starts, and the heading stays for
  // assistive technology.
  return (
    <>
      <p className="sr-only">{heading}</p>
      <span aria-hidden="true" className="mx-auto mb-[12px] block h-px w-6 bg-app-border" />
    </>
  );
}

type NavSectionProps = {
  section: SidebarSection;
  isFirst: boolean;
  signals: Parameters<typeof navItemState>[1];
  layout: { indicatorLayoutId: string; pointerY: MotionValue<number> };
  collapsed: boolean;
  onNavigate?: () => void;
};

function NavSection({ section, isFirst, signals, layout, collapsed, onNavigate }: NavSectionProps) {
  return (
    <div className={isFirst ? undefined : "pt-[20px]"}>
      {section.heading ? <SectionHeading heading={section.heading} collapsed={collapsed} /> : null}

      <div className="space-y-[5px]">
        {section.items.map((item) => (
          <SidebarNavLink
            key={item.path}
            to={item.path}
            label={item.label}
            icon={item.icon}
            end={item.path === "/"}
            shortcut={navigationShortcut(item.path)}
            indicatorLayoutId={layout.indicatorLayoutId}
            pointerY={layout.pointerY}
            busyLabel="Your onboarding path is being built"
            onNavigate={onNavigate}
            collapsed={collapsed}
            {...navItemState(item.path, signals)}
          />
        ))}
      </div>
    </div>
  );
}

/** The navigation landmark: the sections, their entries and the sliding active pill. */
export function SidebarNav({
  sections,
  ariaLabel,
  hasPmAttentionItems,
  pmBadge,
  unseenSkipAnswerCount,
  isPmSectionActive,
  collapsed,
  onNavigate,
}: SidebarNavProps) {
  const { generation } = useOnboardingJourney();
  /*
    Components put in this user's name that they have not acknowledged yet. Read straight from
    the shared provider rather than passed down like `hasPmAttentionItems`: that one is passed
    because owning the request here would fire it twice over (this renders once for desktop and
    once for the mobile drawer), and the provider already solves exactly that.
  */
  const { unseenComponents } = useMyKnowledgeGaps();
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
  const indicatorLayoutId = indicatorLayoutIdFor(instanceId, sections);
  const signals = {
    hasPmAttentionItems,
    hasUnseenKnowledgeGaps: unseenComponents.length > 0,
    unseenSkipAnswerCount,
    pmBadge,
    isOnboardingRunning: generation.status === "running",
    isPmSectionActive,
  };

  return (
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
        <NavSection
          key={section.heading ?? "primary"}
          section={section}
          isFirst={sectionIndex === 0}
          signals={signals}
          layout={{ indicatorLayoutId, pointerY }}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
