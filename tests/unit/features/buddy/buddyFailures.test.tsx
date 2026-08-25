import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";
import { server } from "../../setup/vitest.setup";

const MESSAGES = "/api/v1/onboarding/me/buddy/messages";
const OPEN = "/api/v1/onboarding/me/buddy/open/stream";

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

/**
 * What the hire is told when the buddy cannot answer.
 *
 * Every failure here used to end at `console.error`. The spinners cleared correctly, but an
 * assistant turn with no text renders as nothing — so a failed reply left the hire's own question
 * sitting under a buddy that had simply never answered, which is indistinguishable from being
 * ignored. On the surface the whole feature is built around, that is the difference between "try
 * again" and "this is broken".
 */
describe("buddy failures", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    // Quiet: every test here provokes a failure the hook is expected to log.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("marks the reply that failed rather than leaving the question unanswered", async () => {
    server.use(
      http.get(MESSAGES, () => HttpResponse.json([])),
      http.post(OPEN, () => greetingStream("Hello!")),
      http.post(MESSAGES, () => HttpResponse.error()),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.sendMessage("where do I start?");
    });

    const [, question, reply] = result.current.messages;
    // The hire's message stays exactly as they sent it...
    expect(question.content).toBe("where do I start?");
    // ...and the turn that was going to answer it says why it did not.
    expect(reply.error).toBeTruthy();
    // Nothing is left spinning behind the failure.
    expect(result.current.isThinking).toBe(false);
  });

  it("says so when the conversation cannot be loaded at all", async () => {
    server.use(http.get(MESSAGES, () => HttpResponse.error()));

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await waitFor(() => expect(result.current.openError).toBeTruthy());
    expect(result.current.messages).toHaveLength(0);
  });

  /**
   * The read runs as the app root mounts, so the request most likely to fail is the first one
   * there will ever be — and the widget never unmounts, so the effect that made it will not make
   * it again. Without releasing the latch, one blip left the hire with an empty buddy for the
   * rest of the session and no way back short of a reload.
   */
  it("can try the failed load again", async () => {
    let attempts = 0;
    server.use(
      http.get(MESSAGES, () => {
        attempts += 1;
        return attempts === 1 ? HttpResponse.error() : HttpResponse.json([]);
      }),
      http.post(OPEN, () => greetingStream("Welcome back!")),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });
    await waitFor(() => expect(result.current.openError).toBeTruthy());

    await act(async () => {
      await result.current.retryOpen();
    });

    await waitFor(() => expect(result.current.messages[0]?.content).toBe("Welcome back!"));
    expect(result.current.openError).toBeNull();
  });

  /**
   * The mirror of the case below, and the reason the rule is not simply "report everything".
   * A visit opens behind the hire, so a greeting they never asked for failing under a
   * conversation they can already read reports a problem they do not have. If they ask
   * something and *that* fails, the reply says so.
   */
  it("stays quiet about a failed greeting under a conversation already on screen", async () => {
    server.use(
      http.get(MESSAGES, () =>
        HttpResponse.json([
          { role: "USER", content: "where do I start?", createdAt: "2026-08-25T09:00:00.000Z" },
          {
            role: "ASSISTANT",
            content: "With the setup guide.",
            createdAt: "2026-08-25T09:00:01.000Z",
          },
        ]),
      ),
      http.post(OPEN, () => HttpResponse.error()),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages.some((message) => message.error)).toBe(false);
    // The read itself worked, so there is nothing to offer a retry for either.
    expect(result.current.openError).toBeNull();
  });

  /**
   * A greeting that fails is the one a hire is least equipped to interpret: on a first visit
   * there is nothing else on screen, so an empty thread reads as "there is no buddy here".
   */
  it("keeps a failed greeting on screen, carrying its reason", async () => {
    server.use(
      http.get(MESSAGES, () => HttpResponse.json([])),
      http.post(OPEN, () => HttpResponse.error()),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].error).toBeTruthy();
    expect(result.current.messages[0].content).toBe("");
  });
});
