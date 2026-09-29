import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BookmarkPlus } from "lucide-react";
import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaveToBoard } from "../../../../src/features/board/save/SaveToBoard";
import { boardService } from "../../../../src/services/boardService";
import { queryKeys } from "../../../../src/services/queryKeys";
import type { AuthoredCardRequest } from "../../../../src/features/board/types";

let selectedProjectId = "p1";
vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId }),
}));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("../../../../src/context/useToast", () => ({ useToast: () => toast }));

const request = (): AuthoredCardRequest => ({ kind: "NOTE", text: "A reply, frozen." });

/** Renders under a client whose cache already holds this project's board, read a moment ago. */
function renderSave(ui: ReactElement) {
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

function props(overrides: Partial<Parameters<typeof SaveToBoard>[0]> = {}) {
  return {
    request,
    label: "Keep on my board",
    icon: <BookmarkPlus />,
    ...overrides,
  };
}

describe("SaveToBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedProjectId = "p1";
    // jsdom on this Node has no Storage backing (CI's Node does); clearing is hygiene when present.
    window.localStorage?.clear();
  });

  /** The one button every "keep this" offer is built on — chat, buddy replies, task cards. */
  it("puts the built card on the selected project's board", async () => {
    const addCard = vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    renderSave(<SaveToBoard {...props()} />);

    await userEvent.click(screen.getByRole("button", { name: "Keep on my board" }));

    await waitFor(() => expect(addCard).toHaveBeenCalledOnce());
    expect(addCard.mock.calls[0][0]).toBe("p1");
    expect(addCard.mock.calls[0][1]).toEqual({ kind: "NOTE", text: "A reply, frozen." });
  });

  it("marks the board stale once the card is really on it", async () => {
    vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    const { client } = renderSave(<SaveToBoard {...props()} />);

    await userEvent.click(screen.getByRole("button", { name: "Keep on my board" }));

    await waitFor(() => expect(boardIsStale(client)).toBe(true));
  });

  /** The board-surface callers still get their callback — for the affordances that are theirs. */
  it("tells the caller the card landed", async () => {
    vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    const onSaved = vi.fn();
    renderSave(<SaveToBoard {...props({ label: "Break this into a checklist", onSaved })} />);

    await userEvent.click(screen.getByRole("button", { name: "Break this into a checklist" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });

  it("leaves the board and the caller alone when the write failed", async () => {
    vi.spyOn(boardService, "addCard").mockRejectedValue(new Error("nope"));
    const onSaved = vi.fn();
    const { client } = renderSave(<SaveToBoard {...props({ onSaved })} />);

    await userEvent.click(screen.getByRole("button", { name: "Keep on my board" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onSaved).not.toHaveBeenCalled();
    expect(boardIsStale(client)).toBe(false);
  });

  it("offers nothing when no project is selected", () => {
    selectedProjectId = "";
    renderSave(<SaveToBoard {...props()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
