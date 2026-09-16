import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { PmWorkspace } from "../../../../src/features/pm-area/PmWorkspace";

const mocks = vi.hoisted(() => ({ selectedProjectId: "proj1" }));

vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [createSelectableProject({ id: "proj1" })],
        selectedProjectId: mocks.selectedProjectId,
      }),
  };
});

vi.mock("../../../../src/features/knowledge-request/useOpenEscalationCount", () => ({
  useOpenEscalationCount: () => 3,
}));

// Each section is its own test's subject; here they only have to say which one is showing.
vi.mock("../../../../src/pages/PmDashboardPage", () => ({
  PmDashboardPage: () => <p>overview section</p>,
}));
vi.mock("../../../../src/pages/TeamManagementPage", () => ({
  TeamManagementPage: () => <p>team section</p>,
}));
vi.mock("../../../../src/pages/TeamMemberDetailPage", () => ({
  TeamMemberDetailPage: ({ userId }: { userId: string }) => <p>profile of {userId}</p>,
}));
vi.mock("../../../../src/features/faq/components/FaqPage", () => ({
  FaqPage: ({ groupId }: { groupId?: string }) => <p>questions section {groupId}</p>,
}));
vi.mock("../../../../src/features/knowledge-gaps/components/KnowledgeGapsPage", () => ({
  KnowledgeGapsPage: () => <p>gaps section</p>,
}));
vi.mock("../../../../src/features/onboarding-metrics/components/OnboardingMetricsPage", () => ({
  OnboardingMetricsPage: () => <p>onboarding section</p>,
}));
vi.mock("../../../../src/features/knowledge-request/components/KnowledgeRequestInboxPage", () => ({
  KnowledgeRequestInboxPage: () => <p>escalations section</p>,
}));
vi.mock("../../../../src/features/pm-area/components/MemberPeekPanel", () => ({
  MemberPeekPanel: () => null,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderWorkspace(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          element={
            <>
              <PmWorkspace />
              <LocationProbe />
            </>
          }
        >
          <Route path="/pm-dashboard" />
          <Route path="/team-management" />
          <Route path="/team/:userId" />
          <Route path="/insights/knowledge-requests" />
          <Route path="/insights/onboarding" />
          <Route path="/insights/faq/:groupId?" />
          <Route path="/insights/knowledge-gaps/:gapId?" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function sectionTabs() {
  return within(screen.getByRole("group", { name: "PM dashboard sections" }));
}

/** A two-finger swipe to the right, fired on the section's content under the tab bar. */
function swipeNext(overText: RegExp) {
  fireEvent.wheel(screen.getByText(overText), { deltaX: 60, deltaY: 0 });
}

describe("PmWorkspace", () => {
  beforeEach(() => {
    mocks.selectedProjectId = "proj1";
  });

  it("keeps one header for every section and ends the tab bar on Escalations", () => {
    renderWorkspace("/insights/faq");

    expect(screen.getByRole("heading", { level: 1, name: "PM Dashboard" })).toBeInTheDocument();
    expect(
      sectionTabs()
        .getAllByRole("button")
        .map((tab) => tab.textContent),
    ).toEqual(["Overview", "Team", "Onboarding", "Questions", "Knowledge gaps", "Escalations3"]);
  });

  it("picks the section from the URL, old addresses included", () => {
    renderWorkspace("/team/user-7");

    expect(screen.getByText("profile of user-7")).toBeInTheDocument();
    expect(sectionTabs().getByRole("button", { name: /Team/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hands a question's id to the questions section, which opens it as a panel", () => {
    renderWorkspace("/insights/faq/g1");

    expect(screen.getByText("questions section g1")).toBeInTheDocument();
  });

  it("navigates when a tab is chosen", async () => {
    const user = userEvent.setup();
    renderWorkspace("/pm-dashboard");

    await user.click(sectionTabs().getByRole("button", { name: /Escalations/ }));

    expect(screen.getByTestId("location")).toHaveTextContent("/insights/knowledge-requests");
  });

  // The inner tab bars used to be skipped by the gesture, which left Roles and the durable
  // answers reachable only by aiming at a second pill bar.
  it("swipes through a section's own tabs before moving on to the next section", () => {
    renderWorkspace("/team-management");

    swipeNext(/team section/);
    expect(screen.getByTestId("location")).toHaveTextContent("/team-management?tab=roles");
  });

  it("swipes from the last tab of a section into the next section", () => {
    renderWorkspace("/team-management?tab=roles");

    swipeNext(/team section/);
    expect(screen.getByTestId("location")).toHaveTextContent("/insights/onboarding");
  });

  it("leaves the section alone while the member panel is open", () => {
    renderWorkspace("/team-management?member=user-7");

    swipeNext(/team section/);
    expect(screen.getByTestId("location")).toHaveTextContent("/team-management?member=user-7");
  });

  it("shows one empty state instead of the sections when no project is selected", () => {
    mocks.selectedProjectId = "";
    renderWorkspace("/pm-dashboard");

    expect(screen.getByText("No project selected")).toBeInTheDocument();
    expect(screen.queryByText("overview section")).not.toBeInTheDocument();
  });
});
