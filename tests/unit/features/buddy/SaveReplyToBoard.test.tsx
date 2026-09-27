import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaveReplyToBoard } from "../../../../src/features/buddy/components/SaveReplyToBoard";
import { boardService } from "../../../../src/services/boardService";
import { queryKeys } from "../../../../src/services/queryKeys";

let selectedProjectId = "p1";
vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId }),
}));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("../../../../src/context/useToast", () => ({ useToast: () => toast }));

/** A reply holding a list — the shape that makes the offer appear at all. */
const REPLY = "Here is how to start:\n\n## Getting started\n\n- Run it locally\n- Open a PR\n";

/**
 * Renders under a client whose cache already holds this project's board, read a moment ago — the
 * exact state that used to keep serving a board without the card that was just kept.
 */
function renderReply(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.board.byProject("p1"), {
    boardId: "b1",
    projectId: "p1",
    cards: [],
  });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { client };
}

const boardIsStale = (client: QueryClient) =>
  client.getQueryState(queryKeys.board.byProject("p1"))?.isInvalidated ?? false;

describe("SaveReplyToBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedProjectId = "p1";
  });

  it("offers nothing when the reply holds no list", () => {
    renderReply(<SaveReplyToBoard content="Just some prose, nothing to tick." />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the reply's list as a checklist card on the selected project", async () => {
    const addCard = vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    renderReply(<SaveReplyToBoard content={REPLY} />);

    await userEvent.click(screen.getByRole("button", { name: /keep as checklist/i }));

    await waitFor(() => expect(addCard).toHaveBeenCalledOnce());
    expect(addCard.mock.calls[0][0]).toBe("p1");
    expect(addCard.mock.calls[0][1]).toMatchObject({
      kind: "CHECKLIST",
      title: "Getting started",
      items: [
        { text: "Run it locally", done: false },
        { text: "Open a PR", done: false },
      ],
    });
  });

  /**
   * Issue #233: the write landed, but the board this dock can be floating over kept serving its
   * cached copy for up to `staleTime`. The card existing is what the button says; the cache is
   * what the hire actually sees.
   */
  it("marks the board stale once the list is really on it", async () => {
    vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    const { client } = renderReply(<SaveReplyToBoard content={REPLY} />);

    await userEvent.click(screen.getByRole("button", { name: /keep as checklist/i }));

    await waitFor(() => expect(boardIsStale(client)).toBe(true));
    // And the button acknowledges, as it always has.
    expect(screen.getByRole("button", { name: /checklist on your board/i })).toBeInTheDocument();
  });

  it("leaves the board alone when the save failed", async () => {
    vi.spyOn(boardService, "addCard").mockRejectedValue(new Error("nope"));
    const { client } = renderReply(<SaveReplyToBoard content={REPLY} />);

    await userEvent.click(screen.getByRole("button", { name: /keep as checklist/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(boardIsStale(client)).toBe(false);
  });
});
