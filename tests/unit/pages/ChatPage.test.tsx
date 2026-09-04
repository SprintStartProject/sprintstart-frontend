import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChatPage } from "../../../src/pages/ChatPage";
import type { ChatMessage } from "../../../src/features/chatbot/types";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", firstName: "Test", lastName: "User", profileIcon: null },
  }),
}));

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "project1" }),
}));

const mockHandleSubmit = vi.fn();
const mockSetNewRequest = vi.fn();
const mockSetSelectedCitation = vi.fn();

const mockChatState = {
  messages: [
    { id: "m1", role: "USER" as const, content: "Hello bot", chat: undefined },
    {
      id: "m2",
      role: "ASSISTANT" as const,
      content: "Hi there",
      chat: undefined,
      citations: [{ artifactId: "c1", filename: "readme.md" }],
    },
  ] as ChatMessage[],
  chatId: "chat1" as string | undefined,
  activeChat: { id: "chat1", userId: "u1", projectId: "project1", title: "Chat 1", createdAt: "" },
  chats: [{ id: "chat1", userId: "u1", projectId: "project1", title: "Chat 1", createdAt: "" }],
  handleSubmit: mockHandleSubmit,
  // Without a project the composer blocks sending, so the send-button test needs one.
  hasProject: true,
  addMessage: vi.fn(),
  isThinking: false,
  isStreaming: false,
  thinkingState: null,
  streamingMessageId: null,
  newRequest: "",
  setNewRequest: mockSetNewRequest,
  selectedCitation: null,
  setSelectedCitation: mockSetSelectedCitation,
  isRailOpen: false,
  setRailOpen: vi.fn(),
  isRailOverlay: true,
  textareaRef: { current: null },
  bottomRef: { current: null },
  scrollContainerRef: { current: null },
  showFilters: false,
  setShowFilters: vi.fn(),
  from: "",
  setFrom: vi.fn(),
  to: "",
  setTo: vi.fn(),
  sourceSystems: [] as const,
  toggleSourceSystem: vi.fn(),
  activeFilterCount: 0,
  clearFilters: vi.fn(),
};

vi.mock("../../../src/features/chatbot/hooks/useChat", () => ({
  useChat: () => ({ ...mockChatState }),
}));

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatState.newRequest = "";
    mockChatState.chatId = "chat1";
    mockChatState.selectedCitation = null;
    mockChatState.messages = [
      { id: "m1", role: "USER" as const, content: "Hello bot", chat: undefined },
      {
        id: "m2",
        role: "ASSISTANT" as const,
        content: "Hi there",
        chat: undefined,
        citations: [{ artifactId: "c1", filename: "readme.md" }],
      },
    ];
  });

  it("renders the message list with user and assistant messages", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Hello bot")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  /*
    A question handed over from the dashboard arrives in the composer already written. Focusing
    a textarea that has a value puts the caret at position 0, so the user was typing in front of
    their own question instead of continuing it.
  */
  it("puts the caret behind a question it was opened with", async () => {
    mockChatState.chatId = undefined;
    mockChatState.newRequest = "What should I work on next?";

    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );

    const composer = screen.getByTestId("chat-input");

    await waitFor(() => {
      expect(composer).toHaveFocus();
      expect((composer as HTMLTextAreaElement).selectionStart).toBe(
        "What should I work on next?".length,
      );
    });
  });

  it("renders citation chips for assistant messages with citations", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    const toggleBtn = screen.getByRole("button", { name: /Sources ·/i });
    await user.click(toggleBtn);
    expect(screen.getByText(/readme\.md/)).toBeInTheDocument();
  });

  it('renders a send textarea labeled "Message"', () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
  });

  it("calls handleSubmit when the send button is clicked with a non-empty message", async () => {
    const user = userEvent.setup();
    mockChatState.newRequest = "test message";
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    const sendButton = screen.getByRole("button", { name: "Send message" });
    await user.click(sendButton);
    expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
  });

  /**
   * `Alt+N`, not `Ctrl+N`: every desktop browser owns that one and opens a window with it, and
   * a page cannot refuse. `state.newChat` rides along because that flag is what stops `useChat`
   * redirecting straight back into the most recent conversation.
   */
  it("starts a new chat on Alt+N", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/chat/chat1"]}>
        <Routes>
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="/chat" element={<p>the new chat</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.keyboard("{Alt>}n{/Alt}");

    expect(await screen.findByText("the new chat")).toBeInTheDocument();
  });

  /**
   * The chord belongs to whichever half of the assistant is on screen, and while the panel
   * slides *both* are mounted — the shell keeps the page being left there for the length of the
   * animation, and the listener is on `window`. Without the gate one keypress would start a new
   * conversation in each. A catch-all route at the buddy's URL is that window exactly: the chat
   * still rendered, the location already the other half's.
   */
  it("ignores Alt+N while the buddy is the half on screen", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/buddy"]}>
        <Routes>
          <Route path="*" element={<ChatPage />} />
          <Route path="/chat" element={<p>the new chat</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.keyboard("{Alt>}n{/Alt}");

    expect(screen.queryByText("the new chat")).not.toBeInTheDocument();
  });

  it("does not render the thought process block when assistant message has no reasoning", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Thought process")).not.toBeInTheDocument();
  });

  /**
   * A turn that already has its answer is a finished turn, and its reasoning is the working
   * rather than the result — so the panel is there and folded, one click from being read. This
   * is the rule that stops a long chain of thought becoming the whole chat window; see
   * `ReasoningPanel`.
   */
  it("folds the thought process away once the answer is there, and opens on request", async () => {
    const user = userEvent.setup();
    mockChatState.messages = [
      ...mockChatState.messages,
      {
        id: "m3",
        role: "ASSISTANT" as const,
        content: "Final answer",
        chat: undefined,
        reasoning: "Let me think...",
      },
    ];
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole("button", { name: /Thought process/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Let me think...")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Let me think...")).toBeInTheDocument();
  });
});
