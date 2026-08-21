import { render, renderHook, act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChat } from "../../../../src/features/chatbot/hooks/useChat";
import { ChatProvider } from "../../../../src/context/ChatProvider";
import { ChatContext } from "../../../../src/context/ChatContext";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";

const mockNavigate = vi.fn();

// Mutable so one test can arrive the way the dashboard's quick-chat card does — no chatId and
// `state.newChat` — while every other test keeps the original fixed chat.
const { routerState } = vi.hoisted(() => {
  const routerState: {
    params: { id?: string };
    location: { pathname: string; state?: { newChat?: boolean } };
  } = {
    params: { id: "chat1" },
    location: { pathname: "/" },
  };

  return { routerState };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => routerState.params,
  useLocation: () => routerState.location,
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "user1", firstName: "Test", lastName: "User" },
    status: "authenticated",
  }),
}));

// ChatProvider scopes the chat list and new chats to the selected project, so it reads
// the project context; the hook throws outside a ProjectProvider.
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

const wrapper = ({ children }: { children: ReactNode }) => <ChatProvider>{children}</ChatProvider>;

const HANDOFF_QUESTION = "What should I work on next?";

/** Puts text in the shared composer, standing in for the dashboard's quick-chat card. */
function Seeder() {
  const ctx = useContext(ChatContext);

  return (
    <button type="button" onClick={() => ctx?.setNewRequest(HANDOFF_QUESTION)}>
      seed
    </button>
  );
}

/** Renders `newRequest` so a test can read what the chat page's composer holds. */
function ComposerProbe() {
  const { newRequest } = useChat();

  return <span data-testid="composer">{newRequest}</span>;
}

/**
 * Provider with the chat page mounted or not.
 *
 * The two phases are the point: the composer is filled while the chat page is *absent*, then
 * the page mounts — which is the order the app produces, the dashboard seeding the text before
 * routing here. Seeding after mount would pass even with the bug, since the draft restore only
 * clobbers on its first run.
 */
function Harness({ chatMounted }: { chatMounted: boolean }) {
  return (
    <ChatProvider>
      <Seeder />
      {chatMounted ? <ComposerProbe /> : null}
    </ChatProvider>
  );
}

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    routerState.params = { id: "chat1" };
    routerState.location = { pathname: "/" };
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("fetches chats and user profile on mount", async () => {
    server.use(
      http.get("/api/v1/chats/me", () =>
        HttpResponse.json({
          chats: [{ id: "chat1", userId: "user1" }],
        }),
      ),
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
      http.get("/api/v1/chats/me/chat1", () => HttpResponse.json({ messages: [] })),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await waitFor(() => {
      expect(result.current.chats).toEqual([{ id: "chat1", userId: "user1" }]);
    });
  });

  /*
    The dashboard's quick-chat card seeds the composer and navigates here with `state.newChat`.
    The per-chat draft restore used to run on mount and overwrite that with the stored draft —
    which was empty — so the question never arrived, whether it was typed or picked from a
    suggestion chip.
  */
  it("keeps a question handed over from another page", async () => {
    routerState.params = {};
    routerState.location = { pathname: "/chat", state: { newChat: true } };

    const { rerender } = render(<Harness chatMounted={false} />);
    await userEvent.click(screen.getByRole("button", { name: "seed" }));

    rerender(<Harness chatMounted />);

    await waitFor(() => expect(screen.getByTestId("composer")).toHaveTextContent(HANDOFF_QUESTION));
  });

  it("still restores this chat's own draft on a plain visit", async () => {
    localStorage.setItem("chatDraft.__new__", "half-written question");
    routerState.params = {};
    routerState.location = { pathname: "/chat" };

    const { result } = renderHook(() => useChat(), { wrapper });

    // No hand-off, so the stored draft wins — the behaviour the draft restore exists for.
    await waitFor(() => expect(result.current.newRequest).toBe("half-written question"));
  });

  it("loads messages when chat is selected", async () => {
    server.use(
      http.get("/api/v1/chats/me", () => HttpResponse.json({ chats: [] })),
      http.get("/api/v1/chats/me/chat1", () =>
        HttpResponse.json({
          messages: [
            {
              id: "msg1",
              content: "previous message",
              role: "USER",
              chat: null,
            },
          ],
        }),
      ),
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

    const { result } = renderHook(() => useChat(), { wrapper });

    await waitFor(() => {
      expect(result.current.messages).toEqual([
        {
          id: "msg1",
          content: "previous message",
          role: "USER",
          chat: null,
        },
      ]);
    });
  });

  it("handles streaming flow when adding a message", async () => {
    mockNavigate.mockReset();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"token","content":"Hello "}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"token","content":"world"}\n\n'));
        controller.enqueue(
          encoder.encode('data: {"type":"citation","artifact_id":"1","filename":"file.txt"}\n\n'),
        );
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    server.use(
      http.get("/api/v1/chats/me", () => HttpResponse.json({ chats: [] })),
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
      http.post(
        "/api/v1/chats/me/prompt",
        () =>
          new HttpResponse(stream, {
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
      http.post("/api/v1/chats/me", () =>
        HttpResponse.json({
          id: "newChatId",
        }),
      ),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await waitFor(() => {
      expect(result.current.chats).toEqual([]);
    });

    await act(async () => {
      await result.current.addMessage("My new prompt");
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    const userMsg = result.current.messages[0];
    expect(userMsg.role).toBe("USER");
    expect(userMsg.content).toBe("My new prompt");

    const aiMsg = result.current.messages[1];
    expect(aiMsg.role).toBe("ASSISTANT");
    expect(aiMsg.content).toBe("Hello world");
    expect(aiMsg.citations?.length).toBe(1);
    expect(aiMsg.citations?.[0].filename).toBe("file.txt");

    // Streaming id is cleared once the stream finishes.
    expect(result.current.streamingMessageId).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("surfaces stream errors on the assistant message", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"token","content":"partial"}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"error","message":"LLM overload"}\n\n'));
        controller.close();
      },
    });

    server.use(
      http.get("/api/v1/chats/me", () => HttpResponse.json({ chats: [] })),
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
      http.post(
        "/api/v1/chats/me/prompt",
        () =>
          new HttpResponse(stream, {
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
      http.post("/api/v1/chats/me", () =>
        HttpResponse.json({
          id: "newChatId",
        }),
      ),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await waitFor(() => {
      expect(result.current.chats).toEqual([]);
    });

    await act(async () => {
      await result.current.addMessage("My prompt");
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    const aiMsg = result.current.messages[1];
    expect(aiMsg.role).toBe("ASSISTANT");
    expect(aiMsg.content).toBe("partial");
    expect(aiMsg.error).toBe("LLM overload");
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamingMessageId).toBeNull();
  });

  it("exposes stopStreaming function that can abort a stream", async () => {
    const encoder = new TextEncoder();
    const abortError = new Error("aborted");
    abortError.name = "AbortError";

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"token","content":"partial"}\n\n'));
        setTimeout(() => controller.error(abortError), 50);
      },
    });

    server.use(
      http.get("/api/v1/chats/me", () => HttpResponse.json({ chats: [] })),
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
      http.post(
        "/api/v1/chats/me/prompt",
        () =>
          new HttpResponse(stream, {
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
      http.post("/api/v1/chats/me", () =>
        HttpResponse.json({
          id: "newChatId",
        }),
      ),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await waitFor(() => {
      expect(result.current.chats).toEqual([]);
    });

    expect(typeof result.current.stopStreaming).toBe("function");

    await act(async () => {
      await result.current.addMessage("My prompt");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    // Partial content stays visible
    const aiMsg = result.current.messages[1];
    expect(aiMsg).toBeTruthy();
    expect(aiMsg.content).toBe("partial");
    expect(aiMsg.error).toBeUndefined();
  });

  it("clears isThinking when stopStreaming is called before the first token (B9)", async () => {
    // Stream that never emits a token — simulates the "thinking" phase.
    const stream = new ReadableStream({
      start(_controller) {
        // intentionally never enqueues or closes
      },
    });

    server.use(
      http.get("/api/v1/chats/me", () => HttpResponse.json({ chats: [] })),
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
      http.post(
        "/api/v1/chats/me/prompt",
        () =>
          new HttpResponse(stream, {
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
      http.post("/api/v1/chats/me", () => HttpResponse.json({ id: "newChatId" })),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await waitFor(() => {
      expect(result.current.chats).toEqual([]);
    });

    // Fire addMessage without awaiting — the stream never resolves.
    // Use synchronous act so the initial state update flushes.
    act(() => {
      void result.current.addMessage("hello");
    });

    // Wait for isThinking to turn on.
    await waitFor(() => {
      expect(result.current.isThinking).toBe(true);
    });

    // Stop before any token arrives.
    act(() => {
      result.current.stopStreaming();
    });

    await waitFor(() => {
      expect(result.current.isThinking).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });
  });
});
