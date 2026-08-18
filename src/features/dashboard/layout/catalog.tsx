// ============================================================
// features/dashboard/layout/catalog.tsx
// ============================================================
// Every widget the dashboard can hold: what it is called, how
// big it may be, who may place it, and what it renders.
// ============================================================

import {
  BookOpen,
  Bot,
  Clock,
  Database,
  FolderKanban,
  GraduationCap,
  MessagesSquare,
  Rocket,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import { canAccessRoute } from "../../../auth/accessPolicy";
import { PermissionGroup } from "../../../services/types";
import { IngestionStatusWidget } from "../../data-ingestion/components/IngestionStatusWidget";
import { GreetingWidget } from "../components/GreetingWidget";
import { KnowledgeBaseWidget } from "../components/KnowledgeBaseWidget";
import { OnboardingWidget } from "../components/OnboardingWidget";
import { ProjectOverviewWidget } from "../components/ProjectOverviewWidget";
import { QuickChatWidget } from "../components/QuickChatWidget";
import { RecentChatsWidget } from "../components/RecentChatsWidget";
import { SkillsStrip } from "../components/SkillsStrip";
import { TeamInsightsWidget } from "../components/TeamInsightsWidget";
import { TeamOverviewWidget } from "../components/TeamOverviewWidget";
import { UserOverviewWidget } from "../components/UserOverviewWidget";
import { canSeeTeamInsights } from "../teamInsights";
import type { DashboardWidgetContext, DashboardWidgetDefinition, DashboardWidgetId } from "./types";

/** Available to anyone signed in — no role, no project, nothing to check. */
const always = () => true;

/**
 * The manager widgets read the selected project through endpoints the backend guards with
 * `@projectAuth.canAccessProject`, so the gate is the access policy on the matching route
 * rather than a role check of its own. A PM who merely belongs to the selected project would
 * get 403s and is offered nothing — the same rule that hides the sidebar entries.
 */
const managesSelectedProject = ({ profile, canManageSelectedProject }: DashboardWidgetContext) =>
  canSeeTeamInsights(profile, canManageSelectedProject);

const canIngest = ({ profile, canManageSelectedProject }: DashboardWidgetContext) =>
  canAccessRoute(profile, "/data-ingestion", canManageSelectedProject);

/**
 * Widgets in the order the picker lists them, grouped by tier.
 *
 * The order here is the only thing that decides how the picker reads, so a new widget lands
 * where it belongs by being written there.
 */
export const DASHBOARD_WIDGETS: readonly DashboardWidgetDefinition[] = [
  {
    id: "greeting",
    title: "Greeting",
    description: "Your name, the date and a running clock.",
    icon: Clock,
    tier: "user",
    sizes: ["wide"],
    defaultSize: "wide",
    isAvailable: always,
    render: () => <GreetingWidget />,
  },
  {
    id: "onboarding",
    title: "Onboarding progress",
    description: "How far you are, and the one thing waiting for you next.",
    icon: Rocket,
    tier: "user",
    sizes: ["small", "medium"],
    defaultSize: "medium",
    // Offered exactly while the journey is live — see `useMyOnboardingStatus`.
    isAvailable: ({ hasLiveOnboarding }) => hasLiveOnboarding,
    render: () => <OnboardingWidget />,
  },
  {
    id: "recent-chats",
    title: "Your conversations",
    description: "The questions you were already asking.",
    icon: MessagesSquare,
    tier: "user",
    sizes: ["small", "medium"],
    defaultSize: "medium",
    isAvailable: always,
    render: () => <RecentChatsWidget />,
  },
  {
    id: "knowledge-base",
    title: "Knowledge base",
    description: "The documents the project most recently learned.",
    icon: BookOpen,
    tier: "user",
    sizes: ["small", "medium"],
    defaultSize: "medium",
    isAvailable: always,
    render: () => <KnowledgeBaseWidget />,
  },
  {
    id: "ask-chat",
    title: "Ask the assistant",
    description: "Start a question without leaving the dashboard.",
    icon: Bot,
    tier: "user",
    sizes: ["medium", "wide"],
    defaultSize: "wide",
    isAvailable: always,
    render: () => <QuickChatWidget />,
  },
  {
    id: "skills",
    title: "Role and skills",
    description: "Your project roles and the levels you were assessed at.",
    icon: GraduationCap,
    tier: "user",
    sizes: ["wide"],
    defaultSize: "wide",
    isAvailable: always,
    render: () => <SkillsStrip />,
  },
  {
    id: "team-insights",
    title: "Team insights",
    description: "Knowledge gaps and recurring questions in the selected project.",
    icon: ShieldAlert,
    tier: "manager",
    sizes: ["medium", "wide"],
    defaultSize: "medium",
    isAvailable: managesSelectedProject,
    render: () => <TeamInsightsWidget />,
  },
  {
    id: "team-overview",
    title: "Team overview",
    description: "Onboarding progress across the team, and what is waiting on you.",
    icon: Users,
    tier: "manager",
    sizes: ["small", "medium"],
    defaultSize: "medium",
    isAvailable: managesSelectedProject,
    render: () => <TeamOverviewWidget />,
  },
  {
    id: "data-ingestion",
    title: "Data ingestion",
    description: "Whether the project's connected sources are in sync.",
    icon: Database,
    tier: "manager",
    sizes: ["wide"],
    defaultSize: "wide",
    isAvailable: canIngest,
    render: () => <IngestionStatusWidget />,
  },
  {
    id: "project-overview",
    title: "Projects",
    description: "Every project in the organization, and any without a manager.",
    icon: FolderKanban,
    tier: "admin",
    sizes: ["small", "medium"],
    defaultSize: "medium",
    // The figures are summed from the ADMIN-only project listing; see the widget for why
    // HR, who reaches the same page, must not be offered it.
    isAvailable: ({ profile }) => profile?.permissionGroup === PermissionGroup.ADMIN,
    render: () => <ProjectOverviewWidget />,
  },
  {
    id: "user-overview",
    title: "People",
    description: "Everybody with an account, and who still cannot sign in.",
    icon: UserRound,
    tier: "admin",
    sizes: ["small", "medium"],
    defaultSize: "medium",
    isAvailable: ({ profile }) => canAccessRoute(profile, "/admin"),
    render: () => <UserOverviewWidget />,
  },
];

const widgetsById = new Map(DASHBOARD_WIDGETS.map((widget) => [widget.id, widget]));

export function getDashboardWidget(id: DashboardWidgetId): DashboardWidgetDefinition | undefined {
  return widgetsById.get(id);
}

/** Every id the catalog knows, for validating a layout read back from storage. */
export const DASHBOARD_WIDGET_IDS: readonly DashboardWidgetId[] = DASHBOARD_WIDGETS.map(
  (widget) => widget.id,
);

/** The widgets this user may place, in catalog order. */
export function getAvailableWidgets(context: DashboardWidgetContext): DashboardWidgetDefinition[] {
  return DASHBOARD_WIDGETS.filter((widget) => widget.isAvailable(context));
}
