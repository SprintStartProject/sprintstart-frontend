import { act, renderHook, waitFor, screen } from "@testing-library/react";
import { useContext as useReactContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useChat } from "../../../../src/features/chatbot/hooks/useChat";
import { ChatProvider } from "../../../../src/context/ChatProvider";
import { ChatContext } from "../../../../src/context/ChatContext";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";
import { mockViewport } from "../../setup/matchMedia";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "chat1" }),
  useLocation: () => ({ pathname: "/chat/chat1" }),
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "user1" }, status: "authenticated" }),
}));

vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
      }),
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>
    <ChatProvider>{children}</ChatProvider>
  </ToastProvider>
);

/**
 * A stream the test drives event by event.
 *
 * The queue only exists while an answer is in flight, so a test has to be able to
 * hold a response open, type into it, and then end it on command. The prompt
 * request is therefore served by a `fetch` stub below rather than by MSW: MSW
 * hands the response body over when the handler returns, so anything enqueued
 * after that is never seen by the reader.
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
    /** What the platform would do to the body when the request is aborted. */
    abort: () => {
      try {
        controller.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
      } catch {
        // Already closed — nothing left to abort.
      }
    },
  };
}

type StreamHandle = ReturnType<typeof openStream>;

const PROMPT_URL = "/api/v1/chats/me/prompt";

describe("chat message queue", () => {
  let pending: StreamHandle[] = [];
  let prompts: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockViewport(false);
    pending = [];
    prompts = [];

    server.use(
      http.get("/api/v1/chats/me", () =>
        HttpResponse.json({ chats: [{ id: "chat1", userId: "user1", title: "First chat" }] }),
      ),
      http.get("/api/v1/chats/me/chat1", () => HttpResponse.json({ messages: [] })),
      http.get("/api/v1/users/me", () =>
        HttpResponse.json({
          id: "user1",
          authId: "auth-1",
          username: "testuser",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          projectRoles: [],
          permissionGroup: "USER",
          enabled: true,
          profileIcon: null,
          hasCompletedOnboarding: true,
        }),
      ),
    );

    // Everything except the prompt keeps going through MSW.
    const mswFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes(PROMPT_URL)) return mswFetch(input, init);

      const rawBody = init?.body;
      const body =
        typeof rawBody === "string"
          ? (JSON.parse(rawBody) as { msg?: string })
          : { msg: undefined };
      prompts.push(body.msg ?? "");

      const next = pending.shift();
      if (!next) return Promise.resolve(new HttpResponse(null, { status: 500 }));

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

  /** Mounts the hook with the chat list already loaded. */
  async function mount() {
    const rendered = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(rendered.result.current.chats).toHaveLength(1));
    return rendered;
  }

  it("queues a follow-up instead of cutting the running answer off", async () => {
    const first = openStream();
    pending.push(first);

    const { result } = await mount();

    act(() => {
      result.current.addMessage("First question");
    });
    await waitFor(() => expect(prompts).toEqual(["First question"]));

    act(() => {
      first.token("An answer still being written");
    });
    await waitFor(() => expect(result.current.messages[1]?.content).toContain("still being"));

    act(() => {
      result.current.addMessage("Second question");
    });

    await waitFor(() => expect(result.current.queuedMessages).toHaveLength(1));
    expect(result.current.queuedMessages[0].text).toBe("Second question");

    // The point of the change: the answer under the user's eyes is untouched —
    // no second request, no interruption notice.
    expect(prompts).toEqual(["First question"]);
    expect(result.current.messages[1].notice).toBeUndefined();
    expect(result.current.messages[1].content).toBe("An answer still being written");
  });

  it("sends the queued messages in order, one per finished answer", async () => {
    const first = openStream();
    const second = openStream();
    const third = openStream();
    pending.push(first, second, third);

    const { result } = await mount();

    act(() => {
      result.current.addMessage("Q1");
    });
    await waitFor(() => expect(prompts).toEqual(["Q1"]));

    act(() => {
      result.current.addMessage("Q2");
      result.current.addMessage("Q3");
    });
    await waitFor(() => expect(result.current.queuedMessages).toHaveLength(2));

    act(() => {
      first.finish();
    });

    await waitFor(() => expect(prompts).toEqual(["Q1", "Q2"]));
    expect(result.current.queuedMessages.map((item) => item.text)).toEqual(["Q3"]);

    act(() => {
      second.finish();
    });

    await waitFor(() => expect(prompts).toEqual(["Q1", "Q2", "Q3"]));
    expect(result.current.queuedMessages).toHaveLength(0);
  });

  it("lets a queued message be dropped before it is sent", async () => {
    const first = openStream();
    pending.push(first);

    const { result } = await mount();

    act(() => {
      result.current.addMessage("Q1");
    });
    await waitFor(() => expect(prompts).toEqual(["Q1"]));

    act(() => {
      result.current.addMessage("Never mind");
    });
    await waitFor(() => expect(result.current.queuedMessages).toHaveLength(1));

    act(() => {
      result.current.removeQueuedMessage(result.current.queuedMessages[0].id);
    });

    await waitFor(() => expect(result.current.queuedMessages).toHaveLength(0));

    act(() => {
      first.finish();
    });
    // Nothing left to drain, so no second request was ever made.
    await waitFor(() => expect(result.current.isThinking).toBe(false));
    expect(prompts).toEqual(["Q1"]);
  });

  it("hands a queued message back to the composer for editing", async () => {
    const first = openStream();
    pending.push(first);

    const { result } = await mount();

    act(() => {
      result.current.addMessage("Q1");
    });
    await waitFor(() => expect(prompts).toEqual(["Q1"]));

    act(() => {
      result.current.addMessage("Q2 half-typed");
    });
    await waitFor(() => expect(result.current.queuedMessages).toHaveLength(1));

    act(() => {
      result.current.editQueuedMessage(result.current.queuedMessages[0].id);
    });

    // Out of the queue and back in the composer — leaving it in both would send
    // the edited version and the original.
    await waitFor(() => expect(result.current.queuedMessages).toHaveLength(0));
    expect(result.current.newRequest).toBe("Q2 half-typed");
  });

  it("holds the queue when the user presses Stop, and releases it on request", async () => {
    const first = openStream();
    const second = openStream();
    pending.push(first, second);

    const { result } = await mount();

    act(() => {
      result.current.addMessage("Q1");
    });
    await waitFor(() => expect(prompts).toEqual(["Q1"]));

    act(() => {
      result.current.addMessage("Q2");
    });
    await waitFor(() => expect(result.current.queuedMessages).toHaveLength(1));

    act(() => {
      result.current.stopStreaming();
    });

    // Stop means stop: the queued message stays put and is visibly held.
    await waitFor(() => expect(result.current.queuePaused).toBe(true));
    expect(result.current.queuedMessages).toHaveLength(1);
    expect(prompts).toEqual(["Q1"]);

    act(() => {
      result.current.sendQueuedNow();
    });

    await waitFor(() => expect(prompts).toEqual(["Q1", "Q2"]));
    expect(result.current.queuePaused).toBe(false);
  });

  it("frees the queue after a failed answer rather than holding it hostage", async () => {
    const first = openStream();
    const second = openStream();
    pending.push(first, second);

    const { result } = await mount();

    act(() => {
      result.current.addMessage("Q1");
    });
    await waitFor(() => expect(prompts).toEqual(["Q1"]));

    act(() => {
      result.current.addMessage("Q2");
    });
    await waitFor(() => expect(result.current.queuedMessages).toHaveLength(1));

    act(() => {
      first.fail("LLM overload");
    });

    await waitFor(() => {
      expect(prompts).toEqual(["Q1", "Q2"]);
      expect(result.current.queuedMessages).toHaveLength(0);
    });
  });

  it("interrupts the running answer when the message belongs to another chat", async () => {
    const first = openStream();
    const second = openStream();
    pending.push(first, second);

    const { result } = renderHook(() => ({ chat: useChat(), ctx: useReactContext(ChatContext) }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.chat.chats).toHaveLength(1));

    act(() => {
      result.current.chat.addMessage("Q1");
    });
    await waitFor(() => expect(prompts).toEqual(["Q1"]));

    act(() => {
      result.current.ctx?.submitMessage("chat2", "Somewhere else", mockNavigate);
    });

    // The queue drains per chat, so a message for another conversation cannot
    // wait behind this one — it is sent, and the running turn is settled.
    await waitFor(() => expect(prompts).toEqual(["Q1", "Somewhere else"]));
    await waitFor(() =>
      expect(result.current.chat.messages.find((m) => m.role === "ASSISTANT")?.notice).toBe(
        "interrupted",
      ),
    );
    expect(await screen.findByText("Stopped the answer in the other chat")).toBeInTheDocument();
  });
});
