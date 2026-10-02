import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProviderWithStubs } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

function greetingStream(text: string) {
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
        return greetingStream("Picking up where we left off?");
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
        return greetingStream("Welcome back!");
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
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => greetingStream("Welcome back!")),
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
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => greetingStream("Hello there!")),
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
        return greetingStream("Welcome back!");
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
});
