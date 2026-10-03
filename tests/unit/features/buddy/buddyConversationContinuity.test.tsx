import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProviderWithStubs } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

/** A one-token SSE stream, ended cleanly — the shape both the greeting and a reply arrive in. */
function oneTokenStream(text: string) {
  const encoder = new TextEncoder();
  return new HttpResponse(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: {"type":"token","content":"${text}"}\n\n`));
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

const conversation = [
  { role: "USER" as const, content: "where do I start?", createdAt: "2026-08-25T09:00:00.000Z" },
  {
    role: "ASSISTANT" as const,
    content: "With the setup guide.",
    createdAt: "2026-08-25T09:00:01.000Z",
  },
];

/**
 * Coming back to the buddy is a read now, not a new visit — and what a read must not do is
 * greet over what it read. The articles of the rule:
 *
 * - A conversation with anything in it is shown as it is. The greeting belongs to the
 *   conversation; a second one under the transcript was the visit divider's whole reason to
 *   exist, and both are gone with the visit model.
 * - The one, still-empty first conversation opens with the greeting — that greeting is the only
 *   thing that reads the buddy's durable memory, so the mechanism keeps its door.
 * - A conversation the hire created on purpose starts empty and stays empty until they speak:
 *   "a new one starts with an empty thread and the composer focused" (see the issue).
 */
describe("buddy conversation continuity", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("keeps the last conversation on screen and does not greet over it", async () => {
    let opened = 0;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json(conversation)),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => {
        opened += 1;
        return oneTokenStream("Picking up where we left off?");
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
    // Settled: the read is done and no open follows it.
    await waitFor(() => {
      expect(result.current.isOpening).toBe(false);
    });

    // What was said before is still readable, exactly as it was read...
    expect(result.current.messages[0].content).toBe("where do I start?");
    expect(result.current.messages[1].content).toBe("With the setup guide.");
    // ...and nothing was written under it: reopening a conversation reads it, nothing more.
    expect(opened).toBe(0);
  });

  /**
   * A window of exactly one message is a greeting nobody answered — the window begins at an
   * opening marker, so nothing after it means the hire never spoke. The client shows it as it
   * was read and never asks for it again; the backend would replay the same words, and a
   * greeting is not worth two openings.
   */
  it("does not greet again over a greeting nobody has answered yet", async () => {
    let opened = 0;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () =>
        HttpResponse.json([
          {
            role: "ASSISTANT",
            content: "Welcome back!",
            createdAt: "2026-08-25T09:00:00.000Z",
          },
        ]),
      ),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => {
        opened += 1;
        return oneTokenStream("Welcome back!");
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });
    expect(opened).toBe(0);
  });

  it("greets a hire whose first conversation is still empty", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => oneTokenStream("Welcome back!")),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe("Welcome back!");
    });
    // Marked as the greeting, not as anything under it: it is the only thing in its conversation.
    expect(result.current.messages[0].isGreeting).toBe(true);
  });

  it("creates the first conversation when the hire has none, and greets it", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/sessions", () => HttpResponse.json({ sessions: [] })),
      http.post("/api/v1/onboarding/me/buddy/sessions", () =>
        HttpResponse.json({ id: "s-new" }, { status: 201 }),
      ),
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => oneTokenStream("Hello there!")),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe("Hello there!");
    });
    expect(result.current.currentSessionId).toBe("s-new");
    expect(result.current.sessions.map((session) => session.id)).toEqual(["s-new"]);
  });

  it("keeps a conversation the hire created on purpose empty — no greeting on reload", async () => {
    let opened = 0;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/sessions", () =>
        HttpResponse.json({
          sessions: [
            {
              id: "s-2",
              title: "",
              userId: "1",
              projectId: null,
              createdAt: "2026-09-30T10:00:00.000Z",
            },
            {
              id: "s-1",
              title: "Getting started",
              userId: "1",
              projectId: null,
              createdAt: "2026-09-29T10:00:00.000Z",
            },
          ],
        }),
      ),
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => {
        opened += 1;
        return oneTokenStream("Welcome back!");
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    await waitFor(() => {
      expect(result.current.currentSessionId).toBe("s-2");
    });
    await waitFor(() => {
      expect(result.current.isOpening).toBe(false);
    });

    // The newest conversation is the one on screen, it is empty, and it stays that way: only
    // the hire's first conversation opens with the greeting.
    expect(result.current.messages).toHaveLength(0);
    expect(opened).toBe(0);
  });

  /**
   * The composer is live from the first paint, so a send can beat the opening read. What it
   * must not then get is a greeting on top of it: the conversation is one the hire has spoken
   * in, however briefly, and "never-spoken" is read as of the read settling.
   */
  it("does not greet over a turn sent while the opening read was still in flight", async () => {
    let opened = 0;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/sessions", () => HttpResponse.json({ sessions: [] })),
      http.post("/api/v1/onboarding/me/buddy/sessions", () =>
        HttpResponse.json({ id: "s-new" }, { status: 201 }),
      ),
      // The read is slow here on purpose; the composer is not.
      http.get("/api/v1/onboarding/me/buddy/messages", async () => {
        await delay(80);
        return HttpResponse.json([]);
      }),
      http.post("/api/v1/onboarding/me/buddy/messages", () => oneTokenStream("Hi!")),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => {
        opened += 1;
        return oneTokenStream("Hello there!");
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    // The hire speaks immediately — long before the opening read settles.
    await act(async () => {
      await result.current.sendMessage("hello?");
    });

    await waitFor(() => {
      expect(result.current.isOpening).toBe(false);
    });

    // Their turn and its reply are the thread; no greeting landed on top of them.
    expect(result.current.messages.some((message) => message.content === "hello?")).toBe(true);
    expect(result.current.messages.some((message) => message.content === "Hi!")).toBe(true);
    expect(opened).toBe(0);
  });

  /**
   * The list is otherwise read once at open and edited locally from there — so a conversation
   * the backend has just named from its first message would read "New conversation" in the
   * rail until a reload. The completed turn on an untitled row is what must bring the name in.
   */
  it("re-reads the conversation list once a first message writes its title", async () => {
    let titled = false;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/sessions", () =>
        HttpResponse.json({
          sessions: [
            {
              id: "session-1",
              title: titled ? "Where do I start?" : "",
              userId: "1",
              projectId: null,
              createdAt: "2026-09-30T09:00:00.000Z",
            },
          ],
        }),
      ),
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => oneTokenStream("Welcome back!")),
      http.post("/api/v1/onboarding/me/buddy/messages", () => {
        // The backend names the conversation from this first message.
        titled = true;
        return oneTokenStream("Hi!");
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    await waitFor(() => {
      expect(result.current.isOpening).toBe(false);
    });
    expect(result.current.sessions[0].title).toBe("");

    await act(async () => {
      await result.current.sendMessage("where do I start?");
    });

    await waitFor(() => {
      expect(result.current.sessions[0].title).toBe("Where do I start?");
    });
  });

  /**
   * The create is a round trip, and the composer does not wait for it. A send that begins while
   * it is in flight reads the session ref synchronously, so it lands in the conversation being
   * left — and the switch's clears would wipe its optimistic turn while the answer streamed
   * into a thread nobody is looking at. The send wins: nothing is adopted.
   */
  it("does not adopt a new conversation over a turn that began while it was being created", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => oneTokenStream("Welcome back!")),
      http.post("/api/v1/onboarding/me/buddy/sessions", async () => {
        await delay(80);
        return HttpResponse.json({ id: "s-new" }, { status: 201 });
      }),
      http.post("/api/v1/onboarding/me/buddy/messages", () => oneTokenStream("Hi!")),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => {
      expect(result.current.isOpening).toBe(false);
    });

    let creating: Promise<void> = Promise.resolve();
    await act(async () => {
      creating = result.current.newConversation();
      // The create is in flight (80 ms stub); a turn begins inside that window.
      await delay(10);
      await result.current.sendMessage("hello?");
    });
    await act(async () => {
      await creating;
    });

    // Nothing was adopted and nothing was cleared: the turn the hire actually made is still
    // the thread, and the conversation being left is still the one on screen.
    expect(result.current.currentSessionId).toBe("session-1");
    expect(result.current.sessions.map((session) => session.id)).toEqual(["session-1"]);
    expect(result.current.messages.some((message) => message.content === "hello?")).toBe(true);
    expect(result.current.messages.some((message) => message.content === "Hi!")).toBe(true);
  });

  /**
   * The banner's "Try again" must redo what actually failed. It used to run the opening read,
   * which no-ops out of a loaded conversation — so the banner cleared and nothing else happened.
   */
  it("retries a failed new conversation as itself, not the opening read", async () => {
    let attempts = 0;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => oneTokenStream("Welcome back!")),
      http.post("/api/v1/onboarding/me/buddy/sessions", () => {
        attempts += 1;
        return attempts === 1
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ id: "s-new" }, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => {
      expect(result.current.isOpening).toBe(false);
    });

    await act(async () => {
      await result.current.newConversation();
    });
    expect(result.current.openError).toMatch(/new conversation/);
    expect(result.current.currentSessionId).toBe("session-1");

    await act(async () => {
      await result.current.retryOpen();
    });

    expect(result.current.openError).toBeNull();
    expect(result.current.currentSessionId).toBe("s-new");
    expect(attempts).toBe(2);
  });

  /**
   * "New conversation" must not stack identical empty rows. With a still-untouched newest
   * conversation already around — the state a press leaves, since a hire who leaves it and
   * presses again used to get another — the press brings that one back instead; the next
   * reload would open it anyway, so creating a twin for it only made the pile.
   */
  it("brings back an untouched conversation instead of stacking another empty one", async () => {
    let creates = 0;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/sessions", () =>
        HttpResponse.json({
          sessions: [
            {
              id: "s-1",
              title: "Getting started",
              userId: "1",
              projectId: null,
              createdAt: "2026-09-29T10:00:00.000Z",
            },
          ],
        }),
      ),
      http.post("/api/v1/onboarding/me/buddy/sessions", () => {
        creates += 1;
        return HttpResponse.json({ id: "s-new" }, { status: 201 });
      }),
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => oneTokenStream("Welcome back!")),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => {
      expect(result.current.currentSessionId).toBe("s-1");
    });

    // Nothing untouched exists yet, so this press creates the one empty conversation...
    await act(async () => {
      await result.current.newConversation();
    });
    expect(result.current.currentSessionId).toBe("s-new");
    expect(creates).toBe(1);

    // ...and coming back to an older conversation later, pressing again brings that same
    // untouched one back rather than creating a second.
    await act(async () => {
      await result.current.selectSession("s-1");
    });
    await act(async () => {
      await result.current.newConversation();
    });

    expect(result.current.currentSessionId).toBe("s-new");
    expect(creates).toBe(1);
  });
});
