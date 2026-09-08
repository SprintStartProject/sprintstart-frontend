import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { KnowledgeBaseWidget } from "../../../../src/features/dashboard/components/KnowledgeBaseWidget";
import type { Artifact } from "../../../../src/features/knowledge-base/types";
import type { UserProfile } from "../../../../src/services/types";
import { PermissionGroup } from "../../../../src/services/types";
import type { ProjectContextValue } from "../../../../src/features/projects/ProjectContext";
import { createProjectContextValue } from "../../setup/projectContext";

const { mocks } = vi.hoisted(() => {
  const mocks: {
    profile: UserProfile | null;
    projectContext: ProjectContextValue | null;
    getRecentArtifacts: ReturnType<typeof vi.fn>;
  } = {
    profile: null,
    projectContext: null,
    getRecentArtifacts: vi.fn(),
  };

  return { mocks };
});

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: mocks.profile }),
}));

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => mocks.projectContext,
}));

vi.mock("../../../../src/services/knowledgeService", () => ({
  knowledgeService: { getRecentArtifacts: mocks.getRecentArtifacts },
}));

const createProfile = (projectIds: string[]): UserProfile => ({
  id: "user1",
  authId: "auth-user1",
  username: "Test",
  email: "test@test.com",
  firstName: "Test",
  lastName: "User",
  projectRoles: [],
  projectIds,
  permissionGroup: PermissionGroup.USER,
  enabled: true,
  profileIcon: null,
  hasCompletedOnboarding: false,
});

const createArtifact = (title: string): Artifact => ({
  id: `artifact-${title}`,
  title,
  artifactType: "FILE",
  sourceSystem: "UPLOAD",
  sourceId: "source-1",
  sourceUrl: null,
  mime: "text/markdown",
  language: null,
  ingestedAt: "2026-08-20T00:00:00Z",
  lastChangedAt: null,
  contentHash: null,
  ingestionRunId: null,
});

const renderWidget = () =>
  render(
    <MemoryRouter>
      <KnowledgeBaseWidget />
    </MemoryRouter>,
  );

describe("KnowledgeBaseWidget", () => {
  beforeEach(() => {
    mocks.getRecentArtifacts.mockReset();
    mocks.getRecentArtifacts.mockResolvedValue([createArtifact("Runbook")]);
    mocks.profile = createProfile(["membership-project"]);
    mocks.projectContext = createProjectContextValue({ selectedProjectId: "selected-project" });
  });

  /**
   * The card sits under the same project switcher as everything else and links
   * to the Knowledge Base page, which reads the selection the same way. Reading
   * the profile's first project instead left it showing one project while the
   * header named another — and querying a project a PM manages without being a
   * member of is exactly the case the profile cannot answer.
   */
  it("loads the artifacts of the selected project, not the profile's first one", async () => {
    renderWidget();

    await waitFor(() => expect(mocks.getRecentArtifacts).toHaveBeenCalled());
    expect(mocks.getRecentArtifacts).toHaveBeenCalledWith("selected-project", expect.any(Number));
  });

  it("reloads when the project is switched", async () => {
    const { rerender } = renderWidget();

    await waitFor(() =>
      expect(mocks.getRecentArtifacts).toHaveBeenCalledWith("selected-project", expect.any(Number)),
    );

    mocks.projectContext = createProjectContextValue({ selectedProjectId: "other-project" });
    rerender(
      <MemoryRouter>
        <KnowledgeBaseWidget />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(mocks.getRecentArtifacts).toHaveBeenCalledWith("other-project", expect.any(Number)),
    );
  });

  /**
   * The context starts empty while the project list loads. Falling back to the
   * profile keeps the card populated across that gap rather than flashing an
   * empty state, and covers a user who has no switcher at all.
   */
  it("falls back to the profile's project until the selection arrives", async () => {
    mocks.projectContext = createProjectContextValue({ selectedProjectId: "" });

    renderWidget();

    await waitFor(() =>
      expect(mocks.getRecentArtifacts).toHaveBeenCalledWith(
        "membership-project",
        expect.any(Number),
      ),
    );
  });

  it("links each artifact to the document rather than the bare page", async () => {
    renderWidget();

    const link = await screen.findByRole("link", { name: /Runbook/ });
    expect(link).toHaveAttribute("href", "/knowledge-base?artifact=artifact-Runbook");
  });
});
