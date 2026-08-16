import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { CreateProjectWizard } from "../../../src/features/admin/components/CreateProjectWizard";

vi.mock("../../../src/services/projectService", () => ({
  projectService: {
    createProject: vi.fn(),
    getManagerCandidates: vi.fn().mockResolvedValue([]),
    setProjectManager: vi.fn(),
    assignUsersToProject: vi.fn(),
  },
}));

vi.mock("../../../src/services/sources/githubService", () => ({
  getGithubPatNames: vi.fn().mockResolvedValue(["team-pat"]),
  discoverRepositories: vi.fn(),
  connectGithubRepository: vi.fn(),
  addRepositoryToProject: vi.fn(),
  addGithubPat: vi.fn(),
}));

describe("CreateProjectWizard Accessibility", () => {
  it("has no axe violations on the details step", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <CreateProjectWizard
          isOpen
          tokenNames={["team-pat"]}
          users={[]}
          onClose={vi.fn()}
          onProjectCreated={vi.fn()}
        />
      </MemoryRouter>,
    );

    await screen.findByRole("dialog", { name: "New Project" });
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeInTheDocument());

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
