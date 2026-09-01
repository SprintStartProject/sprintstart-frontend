import { render, renderHook, act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChat } from "../../../../src/features/chatbot/hooks/useChat";
import { ChatProvider } from "../../../../src/context/ChatProvider";
import { ChatContext } from "../../../../src/context/ChatContext";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";
import { mockViewport } from "../../setup/matchMedia";

const mockNavigate = vi.fn();

// Mutable so one test can arrive the way the dashboard's quick-chat card does — no chatId and
// `state.newChat` — while every other test keeps the original fixed chat.
const { routerState, projectState } = vi.hoisted(() => {
  const routerState: {
    params: { id?: string };
    location: { pathname: string; state?: { newChat?: boolean } };
  } = {
    params: { id: "chat1" },
    location: { pathname: "/" },
  };
  // Mutable so the project-switch race test can change the selected project
  // between renders, the way the real header switcher does.
  const projectState = { selectedProjectId: "proj1" };

  return { routerState, projectState };
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
  const projectB = createSelectableProject({ id: "proj2" });
  return {
    useProjectContext: () => {
      const selected =
        projectState.selectedProjectId === "proj2"
          ? { project: projectB, projects: [project, projectB] }
          : { project, projects: [project] };
      return createProjectContextValue({
        projects: selected.projects,
        selectedProject: selected.project,
        selectedProjectId: projectState.selectedProjectId,
      });
    },
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
    // Back to the narrowest viewport between tests: `mockViewport` writes to `window`, so a
    // test that pinned a desktop width would otherwise decide the layout of every one after it.
    mockViewport(false);
    routerState.params = { id: "chat1" };
    routerState.location = { pathname: "/" };
    projectState.selectedProjectId = "proj1";
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  /**
   * Collapsing the conversation rail is a statement about how much room this window has to
   * spare, and it survived exactly until the next reload. It is remembered per browser rather
   * than per chat or per user for the same reason: it is about the window, not the content.
   */
  it("remembers the conversation rail being collapsed", () => {
    // The preference only applies where the rail is a column. jsdom reports the narrowest
    // viewport by default, which is the width where it is a drawer instead.
    mockViewport(true);

    const { result } = renderHook(() => useChat(), { wrapper });

    expect(result.current.isRailOpen).toBe(true);

    act(() => result.current.setRailOpen(false));

    expect(result.current.isRailOpen).toBe(false);

    // A fresh mount, the way a reload arrives.
    expect(renderHook(() => useChat(), { wrapper }).result.current.isRailOpen).toBe(false);
  });

  /**
   * The same preference, deliberately not honoured on a phone: there the rail is a drawer over
   * the conversation, and restoring it on load would put the app behind its own chat list on
   * every visit.
   */
  it("does not reopen the rail over the conversation on a narrow screen", () => {
    mockViewport(true);
    const wide = renderHook(() => useChat(), { wrapper });

    act(() => wide.result.current.setRailOpen(true));
    expect(wide.result.current.isRailOpen).toBe(true);

    mockViewport(false);
    const narrow = renderHook(() => useChat(), { wrapper });

    expect(narrow.result.current.isRailOverlay).toBe(true);
    expect(narrow.result.current.isRailOpen).toBe(false);
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

  it("deletes a chat and redirects if deleting active chat", async () => {
    let deleteCalled = false;
    let getMessagesCalls = 0;
    server.use(
      http.get("/api/v1/chats/me", () =>
        HttpResponse.json({
          chats: [
            { id: "chat1", userId: "user1" },
            { id: "chat2", userId: "user1" },
          ],
        }),
      ),
      http.get("/api/v1/chats/me/chat1", () => {
        getMessagesCalls++;
        return HttpResponse.json({ messages: [] });
      }),
      http.delete("/api/v1/chats/me/chat1", () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
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
      expect(result.current.chats).toHaveLength(2);
    });

    const callsBeforeDelete = getMessagesCalls;

    await act(async () => {
      await result.current.deleteChat("chat1");
    });

    expect(deleteCalled).toBe(true);
    expect(getMessagesCalls).toBe(callsBeforeDelete);
    expect(mockNavigate).toHaveBeenCalledWith("/chat", { replace: true, state: { newChat: true } });
    expect(result.current.chats).toEqual([{ id: "chat2", userId: "user1" }]);
  });

  it("rolls back deletion tracking sets on error so the chat remains functional", async () => {
    server.use(
      http.get("/api/v1/chats/me", () =>
        HttpResponse.json({
          chats: [
            { id: "chat1", userId: "user1" },
            { id: "chat2", userId: "user1" },
          ],
        }),
      ),
      http.get("/api/v1/chats/me/chat1", () => {
        return HttpResponse.json({
          messages: [{ id: "m1", role: "USER", content: "hello", chat: null }],
        });
      }),
      http.delete("/api/v1/chats/me/chat1", () => {
        return new HttpResponse(null, { status: 500 });
      }),
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
      expect(result.current.chats).toHaveLength(2);
    });

    // deleteChat throws on 500
    await expect(
      act(async () => {
        await result.current.deleteChat("chat1");
      }),
    ).rejects.toThrow();

    // Chat is still present in state
    expect(result.current.chats.some((c) => c.id === "chat1")).toBe(true);
  });

  it("does not redirect away when deleting the active chat fails", async () => {
    server.use(
      http.get("/api/v1/chats/me", () =>
        HttpResponse.json({
          chats: [
            { id: "chat1", userId: "user1" },
            { id: "chat2", userId: "user1" },
          ],
        }),
      ),
      http.get("/api/v1/chats/me/chat1", () => HttpResponse.json({ messages: [] })),
      http.delete("/api/v1/chats/me/chat1", () => new HttpResponse(null, { status: 500 })),
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
      expect(result.current.chats).toHaveLength(2);
    });

    await expect(
      act(async () => {
        await result.current.deleteChat("chat1");
      }),
    ).rejects.toThrow();

    // The user stays in the chat that still exists; navigating to /chat before
    // the backend confirmed the delete left them stranded in the empty state.
    expect(mockNavigate).not.toHaveBeenCalledWith("/chat", {
      replace: true,
      state: { newChat: true },
    });
  });

  it("filters out deleted chats when refreshChats receives a stale list", async () => {
    server.use(
      http.get("/api/v1/chats/me", () =>
        HttpResponse.json({
          chats: [
            { id: "chat1", userId: "user1" },
            { id: "chat2", userId: "user1" },
          ],
        }),
      ),
      http.delete("/api/v1/chats/me/chat1", () => new HttpResponse(null, { status: 204 })),
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
      expect(result.current.chats).toHaveLength(2);
    });

    await act(async () => {
      await result.current.deleteChat("chat1");
    });

    // Chat is removed
    expect(result.current.chats).toEqual([{ id: "chat2", userId: "user1" }]);
  });

  it("attaches stopped error message when stopped during reasoning before first content token", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"reasoning","reasoning":"Thinking deep..."}\n\n'),
        );
      },
    });

    server.use(
      http.get("/api/v1/chats/me", () =>
        HttpResponse.json({ chats: [{ id: "chat1", userId: "user1" }] }),
      ),
      http.get("/api/v1/chats/me/chat1", () => HttpResponse.json({ messages: [] })),
      http.post(
        "/api/v1/chats/me/prompt",
        () =>
          new HttpResponse(stream, {
            headers: { "Content-Type": "text/event-stream" },
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
      expect(result.current.chats).toHaveLength(1);
    });

    act(() => {
      void result.current.addMessage("Explain quantum computing");
    });

    await waitFor(() => {
      const msgs = result.current.messages;
      expect(msgs.some((m) => m.reasoning === "Thinking deep...")).toBe(true);
    });

    // Stop mid-reasoning
    act(() => {
      result.current.stopStreaming();
    });

    await waitFor(() => {
      const assistantMsg = result.current.messages.find((m) => m.role === "ASSISTANT");
      expect(assistantMsg?.reasoning).toBe("Thinking deep...");
      expect(assistantMsg?.error).toBe("Stopped before the assistant replied.");
    });
  });

  it("restores the chat in state when deleteChat fails while streaming", async () => {
    let getChatsCount = 0;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"reasoning","reasoning":"Thinking deep..."}\n\n'),
        );
      },
    });

    server.use(
      http.get("/api/v1/chats/me", () => {
        getChatsCount++;
        return HttpResponse.json({
          chats: [
            { id: "chat1", userId: "user1", title: "Active chat" },
            { id: "chat2", userId: "user1", title: "Second chat" },
          ],
        });
      }),
      http.get("/api/v1/chats/me/chat1", () => HttpResponse.json({ messages: [] })),
      http.post(
        "/api/v1/chats/me/prompt",
        () =>
          new HttpResponse(stream, {
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
      http.delete("/api/v1/chats/me/chat1", () => new HttpResponse(null, { status: 500 })),
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
      expect(result.current.chats).toHaveLength(2);
    });

    // Start streaming on chat1
    act(() => {
      void result.current.addMessage("Explain algorithms");
    });

    await waitFor(() => {
      expect(result.current.isThinking || result.current.isStreaming).toBe(true);
    });

    // Attempt to delete chat1 while streaming, which fails with 500
    await expect(
      act(async () => {
        await result.current.deleteChat("chat1");
      }),
    ).rejects.toThrow();

    // The chat list must be restored after rollback
    await waitFor(() => {
      expect(result.current.chats.some((c) => c.id === "chat1")).toBe(true);
    });
  });

  it("drops a slow chat-list response when the selected project changed mid-flight", async () => {
    // proj1's list is delayed; by the time it lands, the user is on proj2.
    let proj1Requested = false;
    server.use(
      http.get("/api/v1/chats/me", async ({ request }) => {
        const projectId = new URL(request.url).searchParams.get("projectId");
        if (projectId === "proj1") {
          proj1Requested = true;
          await new Promise((resolve) => setTimeout(resolve, 300));
          return HttpResponse.json({ chats: [{ id: "stale-chat", userId: "user1" }] });
        }
        return HttpResponse.json({ chats: [{ id: "fresh-chat", userId: "user1" }] });
      }),
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

    const { result, rerender } = renderHook(() => useChat(), { wrapper });

    // Wait until proj1's fetch is in flight…
    await waitFor(() => {
      expect(proj1Requested).toBe(true);
    });
    // …and switch to proj2 while it is still pending.
    projectState.selectedProjectId = "proj2";
    rerender();

    // proj2's fast list wins.
    await waitFor(() => {
      expect(result.current.chats).toEqual([{ id: "fresh-chat", userId: "user1" }]);
    });
    // Give the delayed proj1 response its remaining time to land.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    // The stale response must have been dropped, not written over proj2's list.
    expect(result.current.chats).toEqual([{ id: "fresh-chat", userId: "user1" }]);
  });
});
