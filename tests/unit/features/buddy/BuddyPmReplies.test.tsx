import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BuddyPmReplies } from "../../../../src/features/buddy/components/BuddyPmReplies";
import type {
  CanonicalAnswer,
  KnowledgeRequest,
} from "../../../../src/features/knowledge-request/types";

vi.mock("../../../../src/services/knowledgeRequestService", () => ({
  knowledgeRequestService: { listMine: vi.fn() },
}));

import { knowledgeRequestService } from "../../../../src/services/knowledgeRequestService";
import { usePmReplies } from "../../../../src/features/buddy/hooks/usePmReplies";

/**
 * The grouping moved into `usePmReplies` so the page can ask "is there anything?" without a
 * second request, leaving the rail presentational. The tests still drive it end to end through
 * the mocked `knowledgeRequestService.listMine`, which is what they were always really exercising.
 */
function Harness() {
  const replies = usePmReplies();
  return <BuddyPmReplies {...replies} onClose={vi.fn()} />;
}

function answer(overrides: Partial<CanonicalAnswer> = {}): CanonicalAnswer {
  return {
    id: "a1",
    projectId: "p1",
    question: "How do I get staging credentials?",
    answer: "Ask in #platform and Dana will provision them.",
    authorId: "pm1",
    createdAt: "2026-07-27T10:00:00Z",
    updatedAt: "2026-07-27T10:00:00Z",
    ...overrides,
  };
}

function request(overrides: Partial<KnowledgeRequest> = {}): KnowledgeRequest {
  return {
    id: "r1",
    projectId: "p1",
    hireId: "h1",
    question: "How do I get staging credentials?",
    status: "OPEN",
    createdAt: "2026-07-27T09:00:00Z",
    answeredAt: null,
    answer: null,
    // A hire reading their own escalations is never told who they are.
    hire: null,
    ...overrides,
  };
}

function mockRequests(
  data: KnowledgeRequest[] | null,
  state: { loading?: boolean; error?: boolean } = {},
) {
  if (state.loading) {
    // Never settles, so the query stays pending for the life of the test.
    vi.mocked(knowledgeRequestService.listMine).mockReturnValue(new Promise(() => {}));
  } else if (state.error) {
    vi.mocked(knowledgeRequestService.listMine).mockRejectedValue(new Error("network"));
  } else {
    vi.mocked(knowledgeRequestService.listMine).mockResolvedValue(data ?? []);
  }
}

describe("BuddyPmReplies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when the hire has never escalated anything", async () => {
    mockRequests([]);
    const { container } = render(<Harness />);
    await waitFor(() => expect(knowledgeRequestService.listMine).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while loading, so the page does not shift under the hire", () => {
    mockRequests(null, { loading: true });
    const { container } = render(<Harness />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays silent on a failed load rather than showing an error the hire cannot act on", async () => {
    mockRequests(null, { error: true });
    const { container } = render(<Harness />);
    await waitFor(() => expect(knowledgeRequestService.listMine).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the answer itself, not just that one arrived — the promise the button makes", async () => {
    mockRequests([
      request({
        status: "ANSWERED",
        answeredAt: "2026-07-27T10:00:00Z",
        answer: answer(),
      }),
    ]);
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByText("How do I get staging credentials?")).toBeInTheDocument();
    });
    expect(screen.getByText("Ask in #platform and Dana will provision them.")).toBeInTheDocument();
  });

  it("attributes the answer to the PM, not to the buddy", async () => {
    mockRequests([
      request({ status: "ANSWERED", answeredAt: "2026-07-27T10:00:00Z", answer: answer() }),
    ]);
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByText(/Answered by your PM/)).toBeInTheDocument();
    });
  });

  it("does not treat an ANSWERED request with no answer body as answered", async () => {
    // Defensive: the status and the payload disagreeing would otherwise render an empty answer
    // under a heading claiming the PM replied.
    mockRequests([
      request({ status: "ANSWERED", answeredAt: "2026-07-27T10:00:00Z", answer: null }),
    ]);
    const { container } = render(<Harness />);
    await waitFor(() => expect(knowledgeRequestService.listMine).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a still-open question as waiting, so the hire does not re-flag it", async () => {
    mockRequests([request()]);
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByText("Still with your PM")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Your PM answered/)).not.toBeInTheDocument();
  });

  it("surfaces a dismissed question instead of leaving it waiting forever", async () => {
    mockRequests([request({ status: "DISMISSED" })]);
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByText("Closed without an answer")).toBeInTheDocument();
    });
    expect(screen.queryByText("Still with your PM")).not.toBeInTheDocument();
  });

  it("separates the three outcomes when the hire has all of them", async () => {
    mockRequests([
      request({
        id: "r1",
        status: "ANSWERED",
        answeredAt: "2026-07-27T10:00:00Z",
        answer: answer(),
      }),
      request({ id: "r2", question: "Who reviews infra PRs?" }),
      request({ id: "r3", question: "Is the wiki current?", status: "DISMISSED" }),
    ]);
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByText("Your PM answered")).toBeInTheDocument();
    });
    expect(screen.getByText("Still with your PM")).toBeInTheDocument();
    expect(screen.getByText("Closed without an answer")).toBeInTheDocument();
    expect(screen.getByText("Who reviews infra PRs?")).toBeInTheDocument();
    expect(screen.getByText(/Is the wiki current\?/)).toBeInTheDocument();
  });
});
