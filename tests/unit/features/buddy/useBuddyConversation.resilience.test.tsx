import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProviderWithStubs } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

const MESSAGES = "/api/v1/onboarding/me/buddy/messages";
const OPEN = "/api/v1/onboarding/me/buddy/open/stream";
const SESSIONS = "/api/v1/onboarding/me/buddy/sessions";

/**
 * A reply stream the test drives event by event — the queue suite's contract, reused here so a
 * turn can be held open while the test decides whether it goes quiet, fails, or is re-asked.
 */
function openStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const send = (payload: Record<string, unknown>) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

  return {
    stream,
    token: (content: string) => send({ type: "token", content }),
    reasoning: (reasoning: string) => send({ type: "reasoning", reasoning }),
    fail: (message: string) => {
      send({ type: "error", message });
      controller.close();
    },
    finish: () => {
      send({ type: "done" });
      controller.close();
    },
    abort: () => {
      try {
        controller.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
      } catch {
        // Already closed, nothing left to abort.
      }
    },
  };
}

type StreamHandle = ReturnType<typeof openStream>;

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
 * A turn that goes quiet, a turn that fails, and the "Try again" under it — the resilience half
 * of the send loop. The quiet case is the inter-event watchdog: five silent minutes fail the
 * turn even though the read itself never returns.
 */
describe("a buddy turn under pressure", () => {
  let pending: StreamHandle[] = [];
  let sent: string[] = [];
  let signals: AbortSignal[] = [];

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    pending = [];
    sent = [];
    signals = [];

    server.use(
      http.get(MESSAGES, () => HttpResponse.json([])),
      http.post(OPEN, () => greetingStream("Hello!")),
    );

    const mswFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const isSend = init?.method === "POST" && url.endsWith(MESSAGES);
      if (!isSend) return mswFetch(input, init);

      const rawBody = init?.body;
      const body = typeof rawBody === "string" ? (JSON.parse(rawBody) as { content?: string }) : {};
      sent.push(body.content ?? "");

      const next = pending.shift();
      if (!next) return Promise.resolve(new Response(null, { status: 500 }));

      if (init?.signal) {
        signals.push(init.signal);
        init.signal.addEventListener("abort", () => next.abort(), { once: true });
      }
      return Promise.resolve(
        new Response(next.stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function mount() {
    const rendered = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(rendered.result.current.messages).toHaveLength(1));
    await waitFor(() => expect(rendered.result.current.isGreeting).toBe(false));
    return rendered;
  }

  it("fails a stream that goes silent for five minutes", async () => {
    const first = openStream();
    pending.push(first);
    const { result } = await mount();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => {
      result.current.submitMessage("Q1");
    });
    await waitFor(() => expect(sent).toEqual(["Q1"]));
    await waitFor(() => expect(result.current.isThinking).toBe(true));

    // Not a single event for five minutes: the watchdog aborts the turn...
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });

    // ...and the close-out reads that as a failure, not as the hire's own Stop.
    await waitFor(() => expect(result.current.isThinking).toBe(false));
    const reply = result.current.messages.at(-1);
    expect(reply?.error).toBe("Your buddy stopped responding for five minutes. Try again.");
    expect(reply?.stopped).toBeUndefined();
    expect(signals[0]?.aborted).toBe(true);
  });

  it("keeps a talking turn alive past the total window", async () => {
    const first = openStream();
    pending.push(first);
    const { result } = await mount();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => {
      result.current.submitMessage("Q1");
    });
    await waitFor(() => expect(sent).toEqual(["Q1"]));

    // Four quiet minutes...
    await act(async () => {
      await vi.advanceTimersByTimeAsync(240_000);
    });
    // ...then a thought arrives, proof of life, re-arming the watchdog...
    act(() => {
      first.reasoning("Still working.");
    });
    await waitFor(() => expect(result.current.messages.at(-1)?.reasoning).toBe("Still working."));

    // ...so four more quiet minutes must not fail it: silence is measured between events.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(240_000);
    });
    expect(result.current.isStreaming).toBe(true);

    act(() => {
      first.finish();
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.messages.at(-1)?.error).toBeUndefined();
  });

  it("re-asks a failed turn's question through the composer's own entry point", async () => {
    const first = openStream();
    const second = openStream();
    pending.push(first, second);
    const { result } = await mount();

    act(() => {
      result.current.submitMessage("Q1");
    });
    await waitFor(() => expect(sent).toEqual(["Q1"]));

    act(() => {
      first.fail("boom");
    });
    await waitFor(() => expect(result.current.messages.at(-1)?.error).toBeTruthy());

    const failed = result.current.messages.at(-1);
    if (!failed) throw new Error("no failed turn to retry");
    act(() => {
      result.current.retryReply(failed.id);
    });

    // The same question goes out again — idle, the re-ask sends straight away...
    await waitFor(() => expect(sent).toEqual(["Q1", "Q1"]));
    // ...and the failed pair stays: trying again does not erase what happened.
    expect(result.current.messages.some((message) => message.error)).toBe(true);
  });

  it("re-reads the list after a failed first turn, so the rail picks up its title", async () => {
    let reads = 0;
    server.use(
      http.get(SESSIONS, () => {
        reads += 1;
        return HttpResponse.json({
          sessions: [
            {
              id: "session-1",
              title: reads === 1 ? "" : "Named after Q1",
              userId: "1",
              projectId: null,
              createdAt: "2026-09-30T09:00:00.000Z",
            },
          ],
        });
      }),
    );
    const first = openStream();
    pending.push(first);
    const { result } = await mount();

    act(() => {
      result.current.submitMessage("Q1");
    });
    await waitFor(() => expect(sent).toEqual(["Q1"]));

    act(() => {
      first.fail("boom");
    });

    // The title is written from the hire's message, which the backend kept — a failed turn
    // must not leave the row reading "New conversation" until the next turn.
    await waitFor(() => expect(result.current.sessions[0]?.title).toBe("Named after Q1"));
  });
});
