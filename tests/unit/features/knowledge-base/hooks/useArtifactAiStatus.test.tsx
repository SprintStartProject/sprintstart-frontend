import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_STATUS_POLL_MS,
  useArtifactAiStatus,
} from "../../../../../src/features/knowledge-base/hooks/useArtifactAiStatus";
import type {
  ArtifactAiStatus,
  ArtifactAiStatusResponse,
} from "../../../../../src/features/knowledge-base/types";
import { server } from "../../../setup/vitest.setup";

const STATUS_URL = "/api/v1/projects/:projectId/artifacts/ai-status";

function item(artifactId: string, status: ArtifactAiStatus) {
  return { artifactId, status, updatedAt: null, chunkCount: null };
}

/** Records every request's ids and answers with whatever `respond` returns at that moment. */
function recordStatusRequests(respond: () => ArtifactAiStatusResponse) {
  const requests: string[][] = [];
  server.use(
    http.get(STATUS_URL, ({ request }) => {
      requests.push(new URL(request.url).searchParams.getAll("ids"));
      return HttpResponse.json(respond());
    }),
  );
  return requests;
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useArtifactAiStatus", () => {
  it("sends no request for an empty page or without a project", async () => {
    const requests = recordStatusRequests(() => ({ aiAvailable: true, items: [] }));

    const empty = renderHook(() => useArtifactAiStatus("p1", []), { wrapper: wrapper() });
    const noProject = renderHook(() => useArtifactAiStatus(null, ["a1"]), { wrapper: wrapper() });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requests).toEqual([]);
    expect(empty.result.current).toBeNull();
    expect(noProject.result.current).toBeNull();
  });

  it("asks once per visible page, with that page's ids, and maps status by id", async () => {
    const requests = recordStatusRequests(() => ({
      aiAvailable: true,
      items: [item("a1", "INDEXED"), item("a2", "FAILED"), item("a3", "INDEXED")],
    }));

    const { result, rerender } = renderHook(({ ids }) => useArtifactAiStatus("p1", ids), {
      wrapper: wrapper(),
      initialProps: { ids: ["a1", "a2"] },
    });

    await waitFor(() => expect(result.current?.get("a1")).toBe("INDEXED"));
    expect(result.current?.get("a2")).toBe("FAILED");
    expect(requests).toEqual([["a1", "a2"]]);

    // A new array with the same ids is the same page: no second request.
    rerender({ ids: ["a1", "a2"] });
    // The next page is one more request, for exactly its ids.
    rerender({ ids: ["a3"] });
    await waitFor(() => expect(requests).toEqual([["a1", "a2"], ["a3"]]));
  });

  it("gives no statuses when the AI was unavailable", async () => {
    const requests = recordStatusRequests(() => ({
      aiAvailable: false,
      items: [item("a1", "UNKNOWN")],
    }));

    const { result } = renderHook(() => useArtifactAiStatus("p1", ["a1"]), { wrapper: wrapper() });

    await waitFor(() => expect(requests).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBeNull();
  });

  it("gives no statuses when the request fails, and does not retry", async () => {
    let calls = 0;
    server.use(
      http.get(STATUS_URL, () => {
        calls += 1;
        return HttpResponse.json({ message: "boom" }, { status: 500 });
      }),
    );

    const { result } = renderHook(() => useArtifactAiStatus("p1", ["a1"]), { wrapper: wrapper() });

    await waitFor(() => expect(calls).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls).toBe(1);
    expect(result.current).toBeNull();
  });

  it("polls every 10 s while an item is PROCESSING, and stops once none is", async () => {
    // Only the interval is faked: requests and React Query's own scheduling stay real. RTL's
    // waitFor polls with setInterval, so these two tests use vi.waitFor instead.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let status: ArtifactAiStatus = "PROCESSING";
    const requests = recordStatusRequests(() => ({
      aiAvailable: true,
      items: [item("a1", status), item("a2", "INDEXED")],
    }));

    const { result } = renderHook(() => useArtifactAiStatus("p1", ["a1", "a2"]), {
      wrapper: wrapper(),
    });
    await vi.waitFor(() => expect(result.current?.get("a1")).toBe("PROCESSING"));
    expect(requests).toHaveLength(1);

    // Still processing: the next tick polls.
    await act(() => vi.advanceTimersByTimeAsync(AI_STATUS_POLL_MS));
    await vi.waitFor(() => expect(requests).toHaveLength(2));

    // Indexing finished: this poll sees INDEXED, and after it the polling stops.
    status = "INDEXED";
    await act(() => vi.advanceTimersByTimeAsync(AI_STATUS_POLL_MS));
    await vi.waitFor(() => expect(result.current?.get("a1")).toBe("INDEXED"));
    expect(requests).toHaveLength(3);

    await act(() => vi.advanceTimersByTimeAsync(AI_STATUS_POLL_MS * 3));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests).toHaveLength(3);
  });

  it("never polls a page with nothing PROCESSING", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const requests = recordStatusRequests(() => ({
      aiAvailable: true,
      items: [item("a1", "INDEXED"), item("a2", "FAILED")],
    }));

    const { result } = renderHook(() => useArtifactAiStatus("p1", ["a1", "a2"]), {
      wrapper: wrapper(),
    });
    await vi.waitFor(() => expect(result.current?.get("a1")).toBe("INDEXED"));

    await act(() => vi.advanceTimersByTimeAsync(AI_STATUS_POLL_MS * 3));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests).toHaveLength(1);
  });
});
