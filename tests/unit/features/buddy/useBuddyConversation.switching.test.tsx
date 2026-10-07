import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";
import { BuddyTestProviders, recordingToast } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

const MESSAGES = "/api/v1/onboarding/me/buddy/messages";
const SESSIONS = "/api/v1/onboarding/me/buddy/sessions";

function session(id: string, title: string, createdAt: string) {
  return { id, title, userId: "1", projectId: null, createdAt };
}

const TWO = [
  session("s2", "Second", "2026-10-02T09:00:00.000Z"),
  session("s1", "First", "2026-10-01T09:00:00.000Z"),
];

/** A reply stream the test holds open; an abort ends the read the way a real fetch does. */
function openStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  return {
    stream,
    token: (content: string) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token", content })}\n\n`)),
    abort: () => {
      try {
        controller.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
      } catch {
        // Already closed, nothing left to abort.
      }
    },
  };
}

/**
 * Moving to another conversation while the buddy is still answering: the answer is cut short
 * (a Stop, minus the pause), what was queued behind it is dropped with the conversation it was
 * written for, and the move goes through — it is not refused.
 */
describe("leaving a conversation mid-answer", () => {
  let pending: ReturnType<typeof openStream>[] = [];
  let sent: { content: string; sessionId?: string }[] = [];
  let signals: AbortSignal[] = [];
  let created = 0;

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    pending = [];
    sent = [];
    signals = [];
    created = 0;

    server.use(
      http.get(SESSIONS, () => HttpResponse.json({ sessions: TWO })),
      http.post(SESSIONS, () => {
        created += 1;
        return HttpResponse.json({ id: "s-new" }, { status: 201 });
      }),
      http.get(MESSAGES, ({ request }) => {
        const sessionId = new URL(request.url).searchParams.get("sessionId");
        return HttpResponse.json([
          {
            role: "USER",
            content: `${sessionId} question`,
            createdAt: "2026-10-01T09:00:00.000Z",
          },
          {
            role: "ASSISTANT",
            content: `${sessionId} answer`,
            createdAt: "2026-10-01T09:00:01.000Z",
          },
        ]);
      }),
    );

    const mswFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!(init?.method === "POST" && url.endsWith(MESSAGES))) return mswFetch(input, init);

      const rawBody = init.body;
      const body =
        typeof rawBody === "string"
          ? (JSON.parse(rawBody) as { content?: string; sessionId?: string })
          : {};
      sent.push({ content: body.content ?? "", sessionId: body.sessionId });

      const next = pending.shift();
      if (!next) return Promise.resolve(new Response(null, { status: 500 }));
      if (init.signal) {
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

  function setup() {
    const toast = recordingToast();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <BuddyTestProviders toastValue={toast.value}>
        <BuddyProvider>{children}</BuddyProvider>
      </BuddyTestProviders>
    );
    const rendered = renderHook(() => useBuddy(), { wrapper });
    return { ...rendered, toast };
  }

  async function startTurn(
    result: ReturnType<typeof setup>["result"],
    text: string,
    turn: ReturnType<typeof openStream>,
  ) {
    pending.push(turn);
    await waitFor(() => expect(result.current.currentSessionId).toBe("s2"));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    act(() => {
      result.current.submitMessage(text);
    });
    await waitFor(() => expect(sent.map((item) => item.content)).toContain(text));
    await waitFor(() => expect(result.current.isThinking).toBe(true));
  }

  it("stops the answer, drops the queue and opens the other conversation", async () => {
    const first = openStream();
    const { result, toast } = setup();
    await startTurn(result, "Q1", first);

    // Written while the answer ran, for the conversation about to be left.
    act(() => {
      result.current.submitMessage("Q2");
    });
    expect(result.current.queued.map((item) => item.text)).toEqual(["Q2"]);

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.selectSession("s1");
    });

    // Not a refusal: the answer was cut short and the switch went through.
    expect(switched).toBe(true);
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.currentSessionId).toBe("s1");
    expect(result.current.isThinking).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    await waitFor(() => expect(result.current.messages[0]?.content).toBe("s1 question"));

    // The queued message died with its conversation instead of being sent into it.
    expect(result.current.queued).toEqual([]);
    expect(sent.map((item) => item.content)).toEqual(["Q1"]);

    expect(toast.shown).toContainEqual({
      variant: "info",
      message: "Stopped the answer in the other conversation",
    });
  });

  it("does not toast, and does not abort, when nothing is running", async () => {
    const { result, toast } = setup();
    await waitFor(() => expect(result.current.currentSessionId).toBe("s2"));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.selectSession("s1");
    });

    expect(switched).toBe(true);
    expect(signals).toEqual([]);
    expect(toast.shown).toEqual([]);
  });

  it("starts a new conversation without waiting for the answer to finish", async () => {
    const first = openStream();
    const { result } = setup();
    await startTurn(result, "Q1", first);
    first.token("Partly");

    await act(async () => {
      await result.current.newConversation();
    });

    expect(signals[0]?.aborted).toBe(true);
    expect(created).toBe(1);
    expect(result.current.currentSessionId).toBe("s-new");
    expect(result.current.messages).toEqual([]);
    expect(result.current.isThinking).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });

  it("lets the buddy answer in the conversation it switched to", async () => {
    const first = openStream();
    const second = openStream();
    const { result } = setup();
    await startTurn(result, "Q1", first);

    await act(async () => {
      await result.current.selectSession("s1");
    });

    // The aborted turn took nothing with it: the next one runs in the new conversation.
    pending.push(second);
    act(() => {
      result.current.submitMessage("Q3");
    });
    await waitFor(() => expect(sent.map((item) => item.content)).toEqual(["Q1", "Q3"]));
    expect(sent[1]?.sessionId).toBe("s1");
  });
});
