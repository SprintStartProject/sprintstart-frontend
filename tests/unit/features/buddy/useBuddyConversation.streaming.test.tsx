import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProviderWithStubs } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

const MESSAGES = "/api/v1/onboarding/me/buddy/messages";
const OPEN = "/api/v1/onboarding/me/buddy/open/stream";

/** A reply stream the test drives event by event; see the resilience suite for the contract. */
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
    toolUse: (name: string) => send({ type: "tool_use", name }),
    reset: () => send({ type: "reset" }),
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
 * What the reply looks like while the agent loop streams into it: thoughts as deltas, a `reset`
 * that voids what was written, and words written to state once per frame rather than once per
 * token.
 */
describe("a buddy turn that streams live", () => {
  let pending: StreamHandle[] = [];
  let sent: string[] = [];
  let frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    pending = [];
    sent = [];
    frames = [];

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

      init?.signal?.addEventListener("abort", () => next.abort(), { once: true });
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

  /** Takes the frame clock over, so a test decides when a frame happens. */
  function holdFrames() {
    let nextId = 0;
    const waiting = new Map<number, FrameRequestCallback>();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      nextId += 1;
      waiting.set(nextId, callback);
      frames = [...waiting.values()];
      return nextId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      waiting.delete(id);
      frames = [...waiting.values()];
    });
    runWaiting = () => {
      const due = [...waiting.values()];
      waiting.clear();
      frames = [];
      due.forEach((callback) => callback(0));
    };
  }

  let runWaiting: () => void = () => {};
  const runFrame = () => {
    act(() => runWaiting());
  };

  async function mount() {
    const rendered = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(rendered.result.current.messages).toHaveLength(1));
    await waitFor(() => expect(rendered.result.current.isGreeting).toBe(false));
    return rendered;
  }

  const lastReply = (result: { current: ReturnType<typeof useBuddy> }) =>
    result.current.messages.at(-1);

  it("appends reasoning deltas as they come, without a break per event", async () => {
    const first = openStream();
    pending.push(first);
    const { result } = await mount();

    act(() => {
      result.current.submitMessage("Q1");
    });
    await waitFor(() => expect(sent).toEqual(["Q1"]));

    act(() => {
      first.reasoning("Let me ");
      first.reasoning("check the ");
      first.reasoning("docs.");
    });

    await waitFor(() => expect(lastReply(result)?.reasoning).toBe("Let me check the docs."));
  });

  it("clears the words on a reset and keeps the thoughts", async () => {
    const first = openStream();
    pending.push(first);
    const { result } = await mount();

    act(() => {
      result.current.submitMessage("Q1");
    });
    await waitFor(() => expect(sent).toEqual(["Q1"]));

    act(() => {
      first.reasoning("Thinking.");
      first.token('{"tool": "get_my_metrics"}');
    });
    await waitFor(() => expect(lastReply(result)?.content).toBe('{"tool": "get_my_metrics"}'));

    act(() => {
      first.reset();
    });
    await waitFor(() => expect(lastReply(result)?.content).toBe(""));
    // The typing row takes the reply's place until the new words arrive.
    expect(result.current.isThinking).toBe(true);
    expect(lastReply(result)?.reasoning).toBe("Thinking.");

    act(() => {
      first.token("You are on track.");
    });
    await waitFor(() => expect(lastReply(result)?.content).toBe("You are on track."));
    expect(result.current.isThinking).toBe(false);
  });

  it("drops words that were still waiting for a frame when the reset arrived", async () => {
    holdFrames();
    const first = openStream();
    pending.push(first);
    const { result } = await mount();

    act(() => {
      result.current.submitMessage("Q1");
    });
    await waitFor(() => expect(sent).toEqual(["Q1"]));

    act(() => {
      first.token("First");
    });
    await waitFor(() => expect(lastReply(result)?.content).toBe("First"));

    // These two never reach state: the reset arrives before the frame that would write them.
    act(() => {
      first.token(" and");
      first.token(" more");
      first.reset();
    });
    await waitFor(() => expect(lastReply(result)?.content).toBe(""));
    runFrame();
    expect(lastReply(result)?.content).toBe("");
  });

  it("writes the first word at once and the rest once per frame", async () => {
    holdFrames();
    const first = openStream();
    pending.push(first);
    const { result } = await mount();

    act(() => {
      result.current.submitMessage("Q1");
    });
    await waitFor(() => expect(sent).toEqual(["Q1"]));

    act(() => {
      first.token("One");
    });
    // The first word is not made to wait for a frame: the typing row must not give way to an
    // empty bubble.
    await waitFor(() => expect(lastReply(result)?.content).toBe("One"));

    act(() => {
      first.token(" two");
      first.token(" three");
      first.token(" four");
    });
    // Wait until all three have been read from the stream, then confirm none has been written.
    await waitFor(() => expect(frames.length).toBeGreaterThan(0));
    expect(lastReply(result)?.content).toBe("One");

    runFrame();
    expect(lastReply(result)?.content).toBe("One two three four");
    // Three tokens, one frame callback.
    expect(frames).toHaveLength(0);
  });

  it("keeps what was waiting for a frame when the turn is stopped", async () => {
    holdFrames();
    const first = openStream();
    pending.push(first);
    const { result } = await mount();

    act(() => {
      result.current.submitMessage("Q1");
    });
    await waitFor(() => expect(sent).toEqual(["Q1"]));

    act(() => {
      first.token("Half");
      first.token(" an answer");
    });
    await waitFor(() => expect(frames.length).toBeGreaterThan(0));
    expect(lastReply(result)?.content).toBe("Half");

    act(() => {
      result.current.stopStreaming();
    });

    await waitFor(() => expect(lastReply(result)?.stopped).toBe(true));
    // No frame ran, and the words are there all the same.
    expect(lastReply(result)?.content).toBe("Half an answer");
  });

  it("keeps what was waiting for a frame when the turn finishes", async () => {
    holdFrames();
    const first = openStream();
    pending.push(first);
    const { result } = await mount();

    act(() => {
      result.current.submitMessage("Q1");
    });
    await waitFor(() => expect(sent).toEqual(["Q1"]));

    act(() => {
      first.reasoning("Reading.");
      first.token("Done");
      first.token(".");
      first.finish();
    });

    await waitFor(() => expect(lastReply(result)?.content).toBe("Done."));
    expect(result.current.isStreaming).toBe(false);
    expect(lastReply(result)?.reasoning).toBe("Reading.");
  });
});
