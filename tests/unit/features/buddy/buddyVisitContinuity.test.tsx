import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";
import { server } from "../../setup/vitest.setup";

/**
 * A visit ends when the hire speaks. So opening once they have is not the harmless replay it is
 * before they have — it writes a *new* opening marker, and `getMessagesForMe` returns only from
 * there.
 *
 * The widget used to fire a speculative open on every mount to hide the greeting's latency, on
 * the premise that opening twice is idempotent. It is not, once there is a conversation: every
 * reload, re-login and new tab quietly threw the hire's scrollback away and replaced it with a
 * fresh greeting. Reading first is what makes the latency win safe.
 */
describe("buddy visit continuity", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("shows the conversation on a fresh load without opening a new visit", async () => {
    let opened = false;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () =>
        HttpResponse.json([
          { role: "USER", content: "where do I start?", createdAt: "2026-08-25T09:00:00.000Z" },
          {
            role: "ASSISTANT",
            content: "With the setup guide.",
            createdAt: "2026-08-25T09:00:01.000Z",
          },
        ]),
      ),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => {
        opened = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
    expect(result.current.messages[0].content).toBe("where do I start?");
    // The one that matters: nothing asked the backend to open, so the visit still stands.
    expect(opened).toBe(false);
  });

  it("greets when the visit really is empty", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode('data: {"type":"token","content":"Welcome back!"}\n\n'),
            );
            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
            controller.close();
          },
        });
        return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe("Welcome back!");
    });
  });
});
