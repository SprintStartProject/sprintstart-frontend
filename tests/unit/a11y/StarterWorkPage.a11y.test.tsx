import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { StarterWorkPage } from "../../../src/pages/StarterWorkPage";
import { ToastProvider } from "../../../src/context/ToastProvider";
import { starterWorkService } from "../../../src/services/starterWorkService";
import { userService } from "../../../src/services/userService";
import type {
  StarterWorkCandidate,
  StarterWorkTask,
} from "../../../src/features/starter-work/types";

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

const task: StarterWorkTask = {
  id: "task-1",
  sourceId: "github:acme/repo:ISSUE:42",
  title: "Fix the login redirect",
  summary: "Users land on the wrong page after signing in.",
  rationale: "Touches one file and has clear acceptance criteria.",
  sourceUrl: "https://github.com/acme/repo/issues/42",
  competencyKeys: ["kotlin", "auth"],
  status: "LIVE",
  reviewed: false,
};

const candidate: StarterWorkCandidate = {
  sourceId: "github:acme/repo:ISSUE:43",
  tracker: "GITHUB",
  title: "Document the auth flow",
  excerpt: "The README stops at the login screen.",
  excerptTruncated: false,
  labels: ["docs", "good first issue"],
  sourceUrl: "https://github.com/acme/repo/issues/43",
  hasAssignee: null,
  poolState: "AVAILABLE",
  updatedAtSource: "2026-07-01T00:00:00.000Z",
};

/**
 * The page a PM decides a hire's first task on. Scanned with every section holding something:
 * an empty page passes trivially, and the violations worth catching here live in the review
 * cards, the pool and the issue browser rather than in the shell around them.
 */
describe("StarterWorkPage Accessibility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({ tasks: [task] });
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([
      task,
      { ...task, id: "task-2", title: "Document the auth flow", reviewed: true },
    ]);
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate]);
    vi.spyOn(userService, "getMyProjects").mockResolvedValue([]);
  });

  it("should not have any a11y violations", async () => {
    // The page brings its own `main`, so it is not wrapped in one here. Scanned by `container`
    // rather than `baseElement` for the same reason: `ToastProvider` mounts the app's
    // notification list beside the route, and an empty `ol` that every page shares is chrome
    // this test has no say over.
    const { container } = render(
      <ToastProvider>
        <StarterWorkPage />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Available to new hires")).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
