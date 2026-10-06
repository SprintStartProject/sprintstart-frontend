import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProviderWithStubs } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

/**
 * What binning does to the conversation the session is holding.
 *
 * Binned, not deleted: the backend keeps the conversation until its retention window ends and
 * simply stops returning it — so the session removes the row itself, and remembers the id so a
 * list read that was already in flight cannot put it back. When the binned conversation was the
 * one on screen, the next newest takes its place; with none left, a fresh one starts.
 */

function session(id: string, title: string, createdAt: string) {
  return { id, title, userId: "1", projectId: null, createdAt };
}

const TWO = [
  session("s2", "Second", "2026-10-02T09:00:00.000Z"),
  session("s1", "First", "2026-10-01T09:00:00.000Z"),
];

function sessionsHandler(list: () => unknown[]) {
  return http.get("/api/v1/onboarding/me/buddy/sessions", () =>
    HttpResponse.json({ sessions: list() }),
  );
}

/** Two turns per conversation, named after it, so a switch is visible in the thread. */
function messagesHandler() {
  return http.get("/api/v1/onboarding/me/buddy/messages", ({ request }) => {
    const sessionId = new URL(request.url).searchParams.get("sessionId");

    return HttpResponse.json([
      { role: "USER", content: `${sessionId} question`, createdAt: "2026-10-01T09:00:00.000Z" },
      {
        role: "ASSISTANT",
        content: `${sessionId} answer`,
        createdAt: "2026-10-01T09:00:01.000Z",
      },
    ]);
  });
}

function recordBins() {
  const binned: string[] = [];
  const handler = http.delete("/api/v1/onboarding/me/buddy/sessions/:sessionId", ({ params }) => {
    binned.push(String(params.sessionId));
    return new HttpResponse(null, { status: 204 });
  });

  return { binned, handler };
}

describe("binning a conversation", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("takes the row out and moves off a conversation that was on screen", async () => {
    const { binned, handler } = recordBins();
    server.use(
      sessionsHandler(() => TWO),
      messagesHandler(),
      handler,
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(result.current.currentSessionId).toBe("s2"));

    await act(async () => {
      await result.current.binSession("s2");
    });

    expect(binned).toEqual(["s2"]);
    expect(result.current.sessions.map((s) => s.id)).toEqual(["s1"]);
    expect(result.current.currentSessionId).toBe("s1");
    await waitFor(() => expect(result.current.messages[0]?.content).toBe("s1 question"));
  });

  it("leaves the screen alone when another conversation is binned", async () => {
    const { binned, handler } = recordBins();
    server.use(
      sessionsHandler(() => TWO),
      messagesHandler(),
      handler,
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(result.current.currentSessionId).toBe("s2"));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      await result.current.binSession("s1");
    });

    expect(binned).toEqual(["s1"]);
    expect(result.current.sessions.map((s) => s.id)).toEqual(["s2"]);
    expect(result.current.currentSessionId).toBe("s2");
    expect(result.current.messages[0].content).toBe("s2 question");
  });

  it("does not let a list read that started before the bin put the row back", async () => {
    const { binned, handler } = recordBins();
    let reads = 0;
    // The list stays stale on purpose: every read still returns the binned conversation, the
    // way a read that was already in flight when the bin happened would.
    server.use(
      http.get("/api/v1/onboarding/me/buddy/sessions", () => {
        reads += 1;
        return HttpResponse.json({
          sessions: [
            session("s2", "", "2026-10-02T09:00:00.000Z"),
            session("s1", "First", "2026-10-01T09:00:00.000Z"),
          ],
        });
      }),
      messagesHandler(),
      handler,
      // A turn ending untitled re-reads the list — see the hook's `onDone`.
      http.post("/api/v1/onboarding/me/buddy/messages", () => {
        const encoder = new TextEncoder();
        return new HttpResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: {"type":"token","content":"Sure."}\n\n'));
              controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
              controller.close();
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(result.current.currentSessionId).toBe("s2"));

    await act(async () => {
      await result.current.binSession("s1");
    });

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    // The stale read ran...
    await waitFor(() => expect(reads).toBeGreaterThan(1));
    // ...and the row stayed out.
    expect(result.current.sessions.map((s) => s.id)).toEqual(["s2"]);
    expect(binned).toEqual(["s1"]);
  });

  it("starts a fresh conversation when the last one is binned", async () => {
    const { binned, handler } = recordBins();
    server.use(
      sessionsHandler(() => [session("s1", "Only", "2026-10-01T09:00:00.000Z")]),
      messagesHandler(),
      handler,
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(result.current.currentSessionId).toBe("s1"));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      await result.current.binSession("s1");
    });

    expect(binned).toEqual(["s1"]);
    // The default `POST /buddy/sessions` handler creates `session-new`.
    expect(result.current.currentSessionId).toBe("session-new");
    expect(result.current.sessions.map((s) => s.id)).toEqual(["session-new"]);
    expect(result.current.messages).toEqual([]);
  });

  it("refuses out loud while a turn is in flight, so the list can't toast a bin that never happened", async () => {
    const { binned, handler } = recordBins();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    // A turn whose stream stays open until the test releases it: `isThinking` holds from the
    // moment the message is sent until the first token — exactly the window the guard covers —
    // and with the stream gated there is no token, so no state update happens outside the
    // test's control.
    server.use(
      sessionsHandler(() => TWO),
      messagesHandler(),
      handler,
      http.post("/api/v1/onboarding/me/buddy/messages", () => {
        const encoder = new TextEncoder();
        return new HttpResponse(
          new ReadableStream({
            async start(controller) {
              await gate;
              controller.enqueue(encoder.encode('data: {"type":"token","content":"Sure."}\n\n'));
              controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
              controller.close();
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(result.current.currentSessionId).toBe("s2"));

    let send!: Promise<void>;
    act(() => {
      send = result.current.sendMessage("hello");
    });
    await waitFor(() => expect(result.current.isThinking).toBe(true));

    await expect(result.current.binSession("s1")).rejects.toThrow(/still working/);

    // Nothing was binned, and the list still has both conversations.
    expect(binned).toEqual([]);
    expect(result.current.sessions.map((s) => s.id)).toEqual(["s2", "s1"]);

    release();
    await act(async () => {
      await send;
    });
  });

  it("settles a conversation that is already gone (404) instead of failing the bin", async () => {
    server.use(
      sessionsHandler(() => TWO),
      messagesHandler(),
      http.delete(
        "/api/v1/onboarding/me/buddy/sessions/:sessionId",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(result.current.currentSessionId).toBe("s2"));

    await act(async () => {
      await result.current.binSession("s2");
    });

    // Gone is settled: the row is out and the hire moved off it, exactly as a real bin leaves
    // things — instead of an undeletable row every retry would fail on.
    expect(result.current.sessions.map((s) => s.id)).toEqual(["s1"]);
    expect(result.current.currentSessionId).toBe("s1");
  });

  it("throws when the move off a binned conversation fails, so the list cannot toast a clean bin", async () => {
    const { binned, handler } = recordBins();
    server.use(
      sessionsHandler(() => [session("s1", "Only", "2026-10-01T09:00:00.000Z")]),
      messagesHandler(),
      handler,
      http.post("/api/v1/onboarding/me/buddy/sessions", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(result.current.currentSessionId).toBe("s1"));

    let rejection: unknown;
    await act(async () => {
      rejection = await result.current.binSession("s1").catch((e: unknown) => e);
    });

    expect(rejection).toBeInstanceOf(Error);
    expect(String(rejection)).toMatch(/next conversation/);
    // The DELETE went through, but the screen did not move — the throw is the caller's cue.
    expect(binned).toEqual(["s1"]);
    expect(result.current.sessions).toEqual([]);
    expect(result.current.currentSessionId).toBe("s1");
  });
});
