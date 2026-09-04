import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBoard } from "../../../../src/features/board/hooks/useBoard";
import type { Board } from "../../../../src/features/board/types";

vi.mock("../../../../src/services/boardService", () => ({
  boardService: { fetchBoard: vi.fn(), dismissCard: vi.fn() },
}));

import { boardService } from "../../../../src/services/boardService";

const board = (cardIds: string[]): Board => ({
  boardId: "b1",
  projectId: "p1",
  cards: cardIds.map((id, index) => ({
    id,
    kind: "PATH_TO_FIRST_CONTRIBUTION",
    owner: "AI",
    position: index,
    placedAt: null,
    content: {
      kind: "PATH_TO_FIRST_CONTRIBUTION",
      moments: [],
      acceptedCount: 0,
      autonomyReachedAt: null,
      stalledReason: null,
    },
  })),
});

describe("useBoard", () => {
  beforeEach(() => {
    vi.mocked(boardService.fetchBoard).mockReset();
    vi.mocked(boardService.dismissCard).mockReset();
  });

  it("does not ask for a board when there is no project", async () => {
    const { result } = renderHook(() => useBoard(""));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.board).toBeNull();
    expect(boardService.fetchBoard).not.toHaveBeenCalled();
  });

  it("re-reads the board after removing a card", async () => {
    vi.mocked(boardService.fetchBoard)
      .mockResolvedValueOnce(board(["c1", "c2"]))
      .mockResolvedValueOnce(board(["c2"]));
    vi.mocked(boardService.dismissCard).mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoard("p1"));
    await waitFor(() => expect(result.current.board?.cards).toHaveLength(2));

    await act(async () => {
      await result.current.dismiss("c1");
    });

    // Re-read rather than dropped locally: removing a card is exactly the moment the board's
    // contents change underneath us, and the server knows what is left.
    await waitFor(() => expect(result.current.board?.cards).toHaveLength(1));
    expect(boardService.dismissCard).toHaveBeenCalledWith("c1");
  });

  it("keeps the card and surfaces the failure when removal does not go through", async () => {
    vi.mocked(boardService.fetchBoard).mockResolvedValue(board(["c1"]));
    vi.mocked(boardService.dismissCard).mockRejectedValue(new Error("nope"));

    const { result } = renderHook(() => useBoard("p1"));
    await waitFor(() => expect(result.current.board?.cards).toHaveLength(1));

    await act(async () => {
      await result.current.dismiss("c1");
    });

    // A card that looks gone but is not is worse than one that visibly refused to go.
    expect(result.current.dismissError).toBe(true);
    expect(result.current.board?.cards).toHaveLength(1);
    expect(result.current.dismissingId).toBeNull();
  });
});
