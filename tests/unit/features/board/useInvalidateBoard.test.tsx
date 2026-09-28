import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { useInvalidateBoard } from "../../../../src/features/board/hooks/useInvalidateBoard";
import { queryKeys } from "../../../../src/services/queryKeys";

/** A client holding two projects' boards, read a moment ago. */
function boardContext() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.board.byProject("p1"), {
    boardId: "b1",
    projectId: "p1",
    cards: [],
  });
  client.setQueryData(queryKeys.board.byProject("p2"), {
    boardId: "b2",
    projectId: "p2",
    cards: [],
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return { client, Wrapper };
}

const boardIsStale = (client: QueryClient, projectId: string) =>
  client.getQueryState(queryKeys.board.byProject(projectId))?.isInvalidated ?? false;

describe("useInvalidateBoard", () => {
  it("marks only the board that was written to", async () => {
    const { client, Wrapper } = boardContext();
    const { result } = renderHook(() => useInvalidateBoard("p1"), { wrapper: Wrapper });

    result.current();

    await waitFor(() => expect(boardIsStale(client, "p1")).toBe(true));
    // The other project's board is untouched — the writer knew where the card went.
    expect(boardIsStale(client, "p2")).toBe(false);
  });

  it("marks every cached board when the writer never learned the project", async () => {
    const { client, Wrapper } = boardContext();
    const { result } = renderHook(() => useInvalidateBoard(), { wrapper: Wrapper });

    result.current();

    await waitFor(() => expect(boardIsStale(client, "p1")).toBe(true));
    expect(boardIsStale(client, "p2")).toBe(true);
  });
});
