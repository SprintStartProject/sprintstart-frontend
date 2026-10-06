import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProviderWithStubs } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

const MESSAGES = "/api/v1/onboarding/me/buddy/messages";
const OPEN = "/api/v1/onboarding/me/buddy/open/stream";

/**
 * A reply stream the test drives event by event.
 *
 * The queue only exists while an answer is in flight, so a test has to hold a response open,
 * submit into it, and end it on command. The send request is therefore served by a `fetch` stub
 * rather than by MSW: MSW hands the body over when the handler returns, so anything enqueued
 * afterwards is never seen by the reader.
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
    fail: (message: string) => {
      send({ type: "error", message });
      controller.close();
    },
    finish: () => {
      send({ type: "done" });
      controller.close();
    },
    /** What the platform does to the body when the request is aborted. */
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
 * What a hire can do to messages they submitted while the buddy was still answering: they wait
 * their turn in order, Stop holds them, and they can be sent, dropped or taken back for editing.
 * None of it had a behavioural test before; the surfaces only ever saw it as mocked props.
 */
describe("buddy message queue", () => {
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

    // Everything except a send keeps going through MSW.
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
  });

  /** Mounts the session with its opening settled, so the composer is free to send. */
  async function mount() {
    const rendered = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(rendered.result.current.messages).toHaveLength(1));
    await waitFor(() => expect(rendered.result.current.isGreeting).toBe(false));
    return rendered;
  }

  /** Starts a first turn and leaves its answer open. */
  async function startTurn(
    result: Awaited<ReturnType<typeof mount>>["result"],
    handle: StreamHandle,
    text: string,
  ) {
    act(() => {
      result.current.submitMessage(text);
    });
    await waitFor(() => expect(sent).toContain(text));
    act(() => {
      handle.token("Partial answer");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));
  }

  it("queues a message sent during a running turn and leaves the answer alone", async () => {
    const first = openStream();
    pending.push(first);
    const { result } = await mount();
    await startTurn(result, first, "Q1");

    act(() => {
      result.current.submitMessage("Q2");
    });

    await waitFor(() => expect(result.current.queued).toHaveLength(1));
    expect(result.current.queued[0].text).toBe("Q2");
    // No second request, and the answer under the hire's eyes is untouched.
    expect(sent).toEqual(["Q1"]);
    expect(result.current.messages.at(-1)?.content).toBe("Partial answer");
    expect(result.current.messages.at(-1)?.isIncomplete).toBeUndefined();
  });

  it("sends the queued messages in order, one per finished turn", async () => {
    const first = openStream();
    const second = openStream();
    const third = openStream();
    pending.push(first, second, third);
    const { result } = await mount();
    await startTurn(result, first, "Q1");

    act(() => {
      result.current.submitMessage("Q2");
      result.current.submitMessage("Q3");
    });
    await waitFor(() => expect(result.current.queued).toHaveLength(2));

    act(() => {
      first.finish();
    });
    await waitFor(() => expect(sent).toEqual(["Q1", "Q2"]));
    expect(result.current.queued.map((item) => item.text)).toEqual(["Q3"]);

    act(() => {
      second.finish();
    });
    await waitFor(() => expect(sent).toEqual(["Q1", "Q2", "Q3"]));
    expect(result.current.queued).toHaveLength(0);
  });

  it("does not hold the queue hostage after a failed answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const first = openStream();
    const second = openStream();
    pending.push(first, second);
    const { result } = await mount();
    await startTurn(result, first, "Q1");

    act(() => {
      result.current.submitMessage("Q2");
    });
    await waitFor(() => expect(result.current.queued).toHaveLength(1));

    act(() => {
      first.fail("model overloaded");
    });

    await waitFor(() => expect(sent).toEqual(["Q1", "Q2"]));
    expect(result.current.queued).toHaveLength(0);
  });

  describe("Stop", () => {
    it("aborts the request and closes the turn as cut short, not as failed", async () => {
      const first = openStream();
      pending.push(first);
      const { result } = await mount();
      await startTurn(result, first, "Q1");

      act(() => {
        result.current.stopStreaming();
      });

      await waitFor(() => expect(result.current.isStreaming).toBe(false));
      expect(signals[0].aborted).toBe(true);
      const reply = result.current.messages.at(-1);
      // What arrived is kept and marked, the same state a reload would show...
      expect(reply?.content).toBe("Partial answer");
      expect(reply?.isIncomplete).toBe(true);
      // ...and nothing failed, so there is no error line.
      expect(reply?.error).toBeUndefined();
      expect(result.current.isThinking).toBe(false);
    });

    it("holds the queue, keeping the messages visible", async () => {
      const first = openStream();
      pending.push(first);
      const { result } = await mount();
      await startTurn(result, first, "Q1");

      act(() => {
        result.current.submitMessage("Q2");
      });
      await waitFor(() => expect(result.current.queued).toHaveLength(1));

      act(() => {
        result.current.stopStreaming();
      });

      await waitFor(() => expect(result.current.queuePaused).toBe(true));
      await waitFor(() => expect(result.current.isStreaming).toBe(false));
      expect(result.current.queued.map((item) => item.text)).toEqual(["Q2"]);
      // Stop means stop: the held message does not fire behind it.
      expect(sent).toEqual(["Q1"]);
    });

    it("is a no-op when nothing is streaming", async () => {
      const { result } = await mount();

      act(() => {
        result.current.stopStreaming();
      });

      expect(result.current.queuePaused).toBe(false);
      expect(sent).toEqual([]);
    });
  });

  describe("after Stop", () => {
    /** Q1 running, Q2 and Q3 queued behind it, then Stop: the state every test below starts from. */
    async function stoppedWithQueue() {
      const first = openStream();
      pending.push(first);
      const rendered = await mount();
      await startTurn(rendered.result, first, "Q1");
      act(() => {
        rendered.result.current.submitMessage("Q2");
        rendered.result.current.submitMessage("Q3");
      });
      await waitFor(() => expect(rendered.result.current.queued).toHaveLength(2));
      act(() => {
        rendered.result.current.stopStreaming();
      });
      await waitFor(() => expect(rendered.result.current.queuePaused).toBe(true));
      await waitFor(() => expect(rendered.result.current.isStreaming).toBe(false));
      return rendered;
    }

    it("resumeQueue sends the oldest queued message and releases the hold", async () => {
      const { result } = await stoppedWithQueue();
      const second = openStream();
      pending.push(second);

      act(() => {
        result.current.resumeQueue();
      });

      await waitFor(() => expect(sent).toEqual(["Q1", "Q2"]));
      expect(result.current.queuePaused).toBe(false);
      expect(result.current.queued.map((item) => item.text)).toEqual(["Q3"]);
    });

    it("removeQueued drops one message without sending it", async () => {
      const { result } = await stoppedWithQueue();
      const idOfQ2 = result.current.queued[0].id;

      act(() => {
        result.current.removeQueued(idOfQ2);
      });

      expect(result.current.queued.map((item) => item.text)).toEqual(["Q3"]);
      expect(sent).toEqual(["Q1"]);
    });

    it("pullQueuedMessage hands the text back and takes it out of the queue", async () => {
      const { result } = await stoppedWithQueue();
      const idOfQ3 = result.current.queued[1].id;

      let text: string | null = null;
      act(() => {
        text = result.current.pullQueuedMessage(idOfQ3);
      });

      // Out of the queue and into the caller's hands: leaving it in both places would send the
      // edited version and the original.
      expect(text).toBe("Q3");
      expect(result.current.queued.map((item) => item.text)).toEqual(["Q2"]);
      expect(sent).toEqual(["Q1"]);
    });

    it("pullQueuedMessage on an unknown id changes nothing", async () => {
      const { result } = await stoppedWithQueue();

      let text: string | null = "unset";
      act(() => {
        text = result.current.pullQueuedMessage("no-such-id");
      });

      expect(text).toBeNull();
      expect(result.current.queued).toHaveLength(2);
    });

    it("a new message goes straight out while the old queue stays held", async () => {
      const { result } = await stoppedWithQueue();
      const second = openStream();
      pending.push(second);

      act(() => {
        result.current.submitMessage("Q4");
      });

      // Nothing is streaming any more, so Q4 goes straight out rather than behind the queue.
      await waitFor(() => expect(sent).toEqual(["Q1", "Q4"]));
      expect(result.current.queued.map((item) => item.text)).toEqual(["Q2", "Q3"]);
    });

    it("starting a new conversation empties the queue and the hold", async () => {
      const { result } = await stoppedWithQueue();

      await act(async () => {
        await result.current.newConversation();
      });

      expect(result.current.queued).toHaveLength(0);
      expect(result.current.queuePaused).toBe(false);
      expect(sent).toEqual(["Q1"]);
    });

    it("switching conversation empties the queue and the hold", async () => {
      const { result } = await stoppedWithQueue();

      await act(async () => {
        await result.current.selectSession("session-2");
      });

      expect(result.current.queued).toHaveLength(0);
      expect(result.current.queuePaused).toBe(false);
      expect(sent).toEqual(["Q1"]);
    });
  });
});
