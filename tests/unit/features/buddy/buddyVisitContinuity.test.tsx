import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";
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
 * Coming back to the buddy is two things at once, and the app got each of them wrong on its own
 * before it got both right.
 *
 * A visit ends when the hire speaks, so an open once they have writes a new opening marker and
 * `getMessagesForMe` reads back only to the last one. Opening blind therefore replaced the
 * conversation with a greeting on every reload. But never opening is not the fix: the greeting
 * is the only thing that reads the buddy's durable memory, so a client that stopped opening left
 * that continuity reachable only by pressing "new chat" by hand.
 *
 * Both, in order: read, show, then open underneath.
 */
describe("buddy visit continuity", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("keeps the last conversation on screen and opens the new visit under it", async () => {
    let opened = 0;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json(conversation)),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => {
        opened += 1;
        return greetingStream("Picking up where we left off?");
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(3);
    });

    // What was said before is still readable...
    expect(result.current.messages[0].content).toBe("where do I start?");
    expect(result.current.messages[1].content).toBe("With the setup guide.");
    // ...and the new visit begins under it, greeting from memory rather than from the text above.
    expect(result.current.messages[2].content).toBe("Picking up where we left off?");
    expect(result.current.messages[2].startsVisit).toBe(true);
    expect(opened).toBe(1);
  });

  /**
   * A window of exactly one message is a greeting nobody answered — the window begins at an
   * opening marker, so nothing after it means the hire never spoke. The backend replays that
   * greeting rather than writing a new one, so opening again would put the same words on screen
   * twice.
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

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });
    expect(opened).toBe(0);
  });

  it("greets a hire whose visit really is empty", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => greetingStream("Welcome back!")),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe("Welcome back!");
    });
    // No divider on the first thing in the thread: there is nothing above to divide it from.
    expect(result.current.messages[0].startsVisit).toBeFalsy();
  });
});
