import { Gauge, LayoutDashboard, MessageSquareMore, ShieldAlert, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

type PmSection = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Further paths that belong to the section, e.g. a member's full profile under Team. */
  alsoMatches?: string[];
};

export const PM_SECTIONS: readonly PmSection[] = [
  { to: "/pm-dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/team-management", label: "Team", icon: Users, alsoMatches: ["/team/"] },
  { to: "/insights/onboarding", label: "Onboarding", icon: Gauge },
  { to: "/insights/faq", label: "Questions", icon: MessageSquareMore },
  { to: "/insights/knowledge-gaps", label: "Knowledge gaps", icon: ShieldAlert },
];

function isActive(section: PmSection, pathname: string): boolean {
  return (
    pathname === section.to ||
    pathname.startsWith(`${section.to}/`) ||
    (section.alsoMatches ?? []).some((prefix) => pathname.startsWith(prefix))
  );
}

/**
 * The PM area's own section bar, in the header band of every PM page.
 *
 * Replaces the "Back to PM-Dashboard" buttons each insights page carried: those made the
 * dashboard a hub every trip had to pass through, so going from the questions to the knowledge
 * gaps was two clicks and a page load in between. Now every section is one click from every
 * other.
 *
 * Real links rather than the toggle buttons `SegmentedTabs` renders — each entry is a route, so
 * it should middle-click into a new tab and announce as navigation — but drawn in the same
 * pill so the bar reads as the house control for switching sections.
 */
export function PmAreaNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Project management sections"
      className="inline-flex max-w-full [scrollbar-width:none]! gap-1 overflow-x-auto rounded-2xl border border-app-border/70 bg-app-bg-soft/70 p-1 backdrop-blur-md [&::-webkit-scrollbar]:hidden"
    >
      {PM_SECTIONS.map((section) => {
        const active = isActive(section, pathname);
        const Icon = section.icon;

        return (
          <Link
            key={section.to}
            to={section.to}
            aria-current={active ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
              active
                ? "bg-app-brand text-white shadow-[0_6px_18px_-8px_var(--color-app-brand)]"
                : "text-app-text-muted hover:bg-app-surface hover:text-app-text"
            }`}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
