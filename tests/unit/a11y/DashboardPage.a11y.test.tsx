import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../../src/pages/DashboardPage";
import { PermissionGroup } from "../../../src/services/types";
import type { ProjectContextValue } from "../../../src/features/projects/ProjectContext";
import { createProjectContextValue, createSelectableProject } from "../setup/projectContext";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    permissionGroup: undefined as PermissionGroup | undefined,
    projectContext: null as ProjectContextValue | null,
  },
}));

vi.mock("../../../src/context/useAuth", () => ({
  // `projectRoles` is not optional on `UserProfile`, and the access policy
  // reads it while rendering — a partial fake here takes the whole tree down
  // rather than failing an assertion.
  useAuth: () => ({
    profile: {
      firstName: "Test",
      username: "Test",
      email: "test@test.com",
      projectRoles: [],
      projectIds: [],
      permissionGroup: mocks.permissionGroup,
      hasCompletedOnboarding: false,
    },
  }),
}));

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => mocks.projectContext,
}));

vi.mock("../../../src/services/faqService", () => ({
  insightsService: {
    fetchFAQGroups: vi.fn().mockResolvedValue({
      groups: [{ groupId: "g1", count: 2, question: "How do I deploy?", topDocuments: [] }],
    }),
  },
}));

vi.mock("../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: {
    fetchKnowledgeGaps: vi.fn().mockResolvedValue({
      gaps: [
        {
          id: "gap1",
          component: "auth",
          missingTypes: [],
          lastIngested: "2026-08-01T00:00:00Z",
          refreshedAt: "2026-08-01T00:00:00Z",
          owners: [],
          severity: "high",
        },
        {
          id: "gap2",
          component: "billing",
          missingTypes: [],
          lastIngested: "2026-08-01T00:00:00Z",
          refreshedAt: "2026-08-01T00:00:00Z",
          owners: [],
          severity: "low",
        },
      ],
    }),
  },
}));

describe("DashboardPage Accessibility", () => {
  beforeEach(() => {
    mocks.permissionGroup = undefined;
    mocks.projectContext = createProjectContextValue();
  });

  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  // A manager's dashboard puts different markup in the flexible slot: a card that is itself
  // a button, holding the severity ring and its legend.
  it("should not have any a11y violations with the team insights in the slot", async () => {
    mocks.permissionGroup = PermissionGroup.ADMIN;
    mocks.projectContext = createProjectContextValue({
      projects: [createSelectableProject({ id: "1", name: "Apollo" })],
      selectedProject: createSelectableProject({ id: "1", name: "Apollo" }),
      selectedProjectId: "1",
    });

    const { baseElement } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    // Wait for the figures, so the audit sees the ring rather than the spinner.
    await screen.findByText("Team insights");

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
