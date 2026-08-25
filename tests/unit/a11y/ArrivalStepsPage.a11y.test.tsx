import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { ArrivalStepsPage } from "../../../src/pages/ArrivalStepsPage";
import { arrivalService } from "../../../src/services/arrivalService";
import type { ArrivalStep, DerivableArrivalStep } from "../../../src/features/arrival/types";

vi.mock("../../../src/services/arrivalService", () => ({
  arrivalService: {
    listSteps: vi.fn(),
    listDerivableSteps: vi.fn(),
    createStep: vi.fn(),
    reorderSteps: vi.fn(),
    deleteStep: vi.fn(),
  },
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "p1", name: "Project One" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        projects: [project],
        selectedProject: project,
      }),
  };
});

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "u1", permissionGroup: "PM" } }),
}));

const step: ArrivalStep = {
  key: "vpn",
  projectId: null,
  projectName: null,
  title: "Request VPN access",
  description: "Ask in #it-helpdesk; usually same-day.",
  href: "https://intranet.example/vpn",
  position: 0,
  settledBy: "DECLARED",
  selfConfirmable: true,
  settled: false,
  settledAt: null,
  rigor: null,
};

const derivable: DerivableArrivalStep = {
  key: "github-account",
  suggestedTitle: "Add your GitHub username",
  suggestedDescription: "So work you push can be recognised as yours.",
  selfConfirmable: false,
  added: false,
};

/**
 * The list a PM authors, scanned as a PM sees it — with steps on it and the add controls live.
 * HR reads the same page without them, which is a different tree; the authoring one is scanned
 * because it is the one carrying the interactive controls.
 */
describe("ArrivalStepsPage Accessibility", () => {
  beforeEach(() => {
    vi.mocked(arrivalService.listSteps).mockResolvedValue([step]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable]);
  });

  it("should not have any a11y violations", async () => {
    // The page brings its own landmarks; see `StarterWorkPage.a11y` for why the scan is scoped
    // to the rendered container.
    const { container } = render(<ArrivalStepsPage />);

    await waitFor(() => {
      expect(screen.getByText("Request VPN access")).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
