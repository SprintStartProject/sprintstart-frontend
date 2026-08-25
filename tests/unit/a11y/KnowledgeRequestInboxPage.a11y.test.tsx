import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { KnowledgeRequestInboxPage } from "../../../src/features/knowledge-request/components/KnowledgeRequestInboxPage";
import { knowledgeRequestService } from "../../../src/services/knowledgeRequestService";
import type {
  CanonicalAnswer,
  KnowledgeRequest,
} from "../../../src/features/knowledge-request/types";

vi.mock("../../../src/services/knowledgeRequestService", () => ({
  knowledgeRequestService: {
    listOpen: vi.fn(),
    listAnswers: vi.fn(),
    answer: vi.fn(),
    dismiss: vi.fn(),
    editAnswer: vi.fn(),
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

const answer: CanonicalAnswer = {
  id: "a1",
  projectId: "p1",
  question: "Where do I get staging credentials?",
  answer: "Ask in #platform; they are issued per person, never shared.",
  authorId: "u1",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
};

const request: KnowledgeRequest = {
  id: "r1",
  projectId: "p1",
  hireId: "u2",
  question: "Which branch do I open a pull request against?",
  status: "OPEN",
  createdAt: "2026-07-03T00:00:00.000Z",
  answeredAt: null,
  answer: null,
};

/**
 * The PM's escalation queue, scanned with a question waiting on it — the state the page exists
 * for. An empty inbox renders an empty state and would pass without touching the request cards,
 * which is where the controls are.
 */
describe("KnowledgeRequestInboxPage Accessibility", () => {
  beforeEach(() => {
    vi.mocked(knowledgeRequestService.listOpen).mockResolvedValue([request]);
    vi.mocked(knowledgeRequestService.listAnswers).mockResolvedValue([answer]);
  });

  it("should not have any a11y violations", async () => {
    // The page brings its own landmarks; see `StarterWorkPage.a11y` for why the scan is scoped
    // to the rendered container.
    const { container } = render(<KnowledgeRequestInboxPage />);

    await waitFor(() => {
      expect(screen.getByText(request.question)).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
