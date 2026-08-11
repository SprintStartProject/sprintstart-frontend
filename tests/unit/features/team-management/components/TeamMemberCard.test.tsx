import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeamMemberCard } from "../../../../../src/features/team-management/components/TeamMemberCard";
import type { TeamOverviewUser } from "../../../../../src/features/team-management/types";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../../../src/components/common/UserAvatar", () => ({
  UserAvatar: () => <svg role="img" aria-label="User Avatar" width="40" height="40" />,
}));

function createUser(overrides: Partial<TeamOverviewUser> = {}): TeamOverviewUser {
  return {
    userId: "u1",
    firstname: "Alice",
    lastname: "Smith",
    roles: [{ id: "r1", name: "Backend", description: "" }],
    skills: [],
    progressPercentage: 0.8,
    currentPhase: { id: "p1", title: "Phase 1" },
    currentStep: { id: "s1", title: "Setup", startedAt: new Date().toISOString(), skip: null },
    hasFeedback: false,
    projects: [{ id: "proj1", name: "Project 1" }],
    ...overrides,
  };
}

function renderCard(user = createUser()) {
  return render(
    <MemoryRouter>
      <TeamMemberCard user={user} />
    </MemoryRouter>,
  );
}

describe("TeamMemberCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the member name and roles", () => {
    renderCard();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("renders the current step title", () => {
    renderCard();
    expect(screen.getByText("Setup")).toBeInTheDocument();
  });

  it("renders the progress percentage", () => {
    renderCard(createUser({ progressPercentage: 0.65 }));
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it('renders "No role assigned" when the user has no roles', () => {
    renderCard(createUser({ roles: [] }));
    expect(screen.getByText("No role assigned")).toBeInTheDocument();
  });

  it('renders "No current step" when currentStep is null', () => {
    renderCard(createUser({ currentStep: null }));
    expect(screen.getByText("No current step")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the feedback badge when the user has feedback", () => {
    renderCard(createUser({ hasFeedback: true }));
    expect(screen.getByTitle("Unread onboarding feedback")).toBeInTheDocument();
  });

  it("shows the skip badge when there is a pending skip request", () => {
    renderCard(
      createUser({
        currentStep: {
          id: "s1",
          title: "Setup",
          startedAt: new Date().toISOString(),
          skip: {
            id: "skip1",
            stepId: "s1",
            reason: "too hard",
            status: "PENDING",
            reviewComment: null,
            reviewedAt: null,
          },
        },
      }),
    );
    expect(screen.getByTitle("Open skip request")).toBeInTheDocument();
  });

  it('shows the "In progress" status badge while onboarding is not complete', () => {
    renderCard(createUser({ progressPercentage: 0.8 }));
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.queryByText("Onboarding completed")).not.toBeInTheDocument();
  });

  it('shows the "Onboarding completed" status badge when progress reaches 100%', () => {
    renderCard(createUser({ progressPercentage: 1 }));
    expect(screen.getByText("Onboarding completed")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
  });

  it("shows the onboarding status as an icon badge in compact mode", () => {
    const completed = render(
      <MemoryRouter>
        <TeamMemberCard user={createUser({ progressPercentage: 1 })} compact />
      </MemoryRouter>,
    );
    expect(completed.getByTitle("Onboarding completed")).toBeInTheDocument();
    // No text chip in compact mode.
    expect(completed.queryByText("Onboarding completed")).not.toBeInTheDocument();
    completed.unmount();

    const inProgress = render(
      <MemoryRouter>
        <TeamMemberCard user={createUser({ progressPercentage: 0.4 })} compact />
      </MemoryRouter>,
    );
    expect(inProgress.getByTitle("Onboarding in progress")).toBeInTheDocument();
  });

  it("renders as a link to the member detail page", () => {
    renderCard(createUser({ userId: "user42" }));
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/team/user42");
  });

  it("shows at-risk styling when the user has been on a step for more than 5 days", () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    renderCard(
      createUser({
        currentStep: { id: "s1", title: "Setup", startedAt: sixDaysAgo, skip: null },
      }),
    );
    expect(screen.getByText("6d")).toHaveClass("text-app-warning-text");
  });
});
