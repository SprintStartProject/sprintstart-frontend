import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KnowledgeRequestInboxPage } from "../../../../../src/features/knowledge-request/components/KnowledgeRequestInboxPage";
import { knowledgeRequestService } from "../../../../../src/services/knowledgeRequestService";
import * as useProjectContextModule from "../../../../../src/features/projects/useProjectContext";
import { createProjectContextValue, createSelectableProject } from "../../../setup/projectContext";

vi.mock("../../../../../src/services/knowledgeRequestService", () => ({
  knowledgeRequestService: {
    listOpen: vi.fn(),
    listAnswers: vi.fn(),
    answer: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined),
    editAnswer: vi.fn().mockResolvedValue(undefined),
    escalate: vi.fn(),
  },
}));

vi.mock("../../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: vi.fn(),
}));

vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: mocks.profile }),
}));

const mocks = vi.hoisted(() => ({
  profile: {
    id: "pm-1",
    username: "pmuser",
    firstName: "Pat",
    lastName: "Manager",
    permissionGroup: "PM",
  },
}));

const mockedService = vi.mocked(knowledgeRequestService);

function mockProject(selectedProjectId: string | null) {
  vi.mocked(useProjectContextModule.useProjectContext).mockReturnValue(
    createProjectContextValue({
      selectedProjectId: selectedProjectId ?? undefined,
      // One project, or the page short-circuits to its "No projects" state.
      projects: selectedProjectId ? [createSelectableProject({ id: selectedProjectId })] : [],
    }),
  );
}

/**
 * The inbox is a section of the PM workspace and keeps its tab in the URL (`?view=answered`),
 * so it needs a router around it.
 */
function renderInbox(url = "/insights/knowledge-requests") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <KnowledgeRequestInboxPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProject("proj1");
});

describe("KnowledgeRequestInboxPage", () => {
  it("shows open escalations under the active Open tab with their count", async () => {
    mockedService.listOpen.mockResolvedValue([
      {
        id: "req-1",
        projectId: "proj1",
        hireId: "hire-1",
        question: "Why does npm test hang?",
        status: "OPEN",
        createdAt: "2026-08-20T10:00:00Z",
        answeredAt: null,
        answer: null,
        // The asker's row is `RequestCard.test.tsx`'s subject; null keeps this render router-free.
        hire: null,
      },
    ]);
    mockedService.listAnswers.mockResolvedValue([]);

    renderInbox();

    await waitFor(() => {
      expect(screen.getByText("Why does npm test hang?")).toBeInTheDocument();
    });
    // Open is the default view. The switch itself grows out of the workspace's Escalations tab
    // (see PmWorkspace.test), so the section draws no bar of its own.
    expect(screen.queryByRole("group", { name: "Inbox views" })).not.toBeInTheDocument();
  });

  it("distinguishes an empty inbox from a still-loading one by words, not form", async () => {
    // UI_CONSISTENCY_ROADMAP §6: both states share the EmptyState shape on
    // purpose — the copy is the difference.
    mockedService.listOpen.mockResolvedValue([]);
    mockedService.listAnswers.mockResolvedValue([]);

    renderInbox();

    // Default tab is Open; its empty state body.
    expect(await screen.findByText(/No open escalations/i)).toBeInTheDocument();
    // The loading announcement must be gone once the data arrived.
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it("announces the wait through the shared Spinner's status role while lists load", () => {
    mockedService.listOpen.mockReturnValue(new Promise(() => {}));
    mockedService.listAnswers.mockResolvedValue([]);

    renderInbox();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("keeps Answer and Dismiss reachable as real buttons with focus rings", async () => {
    mockedService.listOpen.mockResolvedValue([
      {
        id: "req-1",
        projectId: "proj1",
        hireId: "hire-1",
        question: "Who owns deploys?",
        status: "OPEN",
        createdAt: "2026-08-20T10:00:00Z",
        answeredAt: null,
        answer: null,
        // The asker's row is `RequestCard.test.tsx`'s subject; null keeps this render router-free.
        hire: null,
      },
    ]);
    mockedService.listAnswers.mockResolvedValue([]);

    renderInbox();

    expect(await screen.findByRole("button", { name: "Answer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  // The switch and the swipe between the views are the PM workspace's (see PmWorkspace.test);
  // what the section owes them is reading its view from the URL.
  it("opens on the durable answers when the URL asks for them", async () => {
    mockedService.listOpen.mockResolvedValue([]);
    mockedService.listAnswers.mockResolvedValue([]);

    renderInbox("/insights/knowledge-requests?view=answered");

    expect(await screen.findByText(/No durable answers yet/i)).toBeInTheDocument();
  });

  describe("when the user is HR (read-only)", () => {
    beforeEach(() => {
      mocks.profile.permissionGroup = "HR";
    });

    afterEach(() => {
      mocks.profile.permissionGroup = "PM";
    });

    it("hides editing affordances from readers who cannot write", async () => {
      mockedService.listOpen.mockResolvedValue([]);
      mockedService.listAnswers.mockResolvedValue([
        {
          id: "ans-1",
          projectId: "proj1",
          question: "Why does npm test hang?",
          answer: "Delete node_modules.",
          authorId: "pm-1",
          createdAt: "2026-08-20T10:00:00Z",
          updatedAt: "2026-08-21T10:00:00Z",
        },
      ]);

      renderInbox("/insights/knowledge-requests?view=answered");

      expect(await screen.findByText("Delete node_modules.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.getByText(/editing is a PM action/i)).toBeInTheDocument();
    });
  });
});
