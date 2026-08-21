import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
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
  sidebarOpen: false,
  setSidebarOpen: vi.fn(),
  desktopSidebarOpen: true,
  setDesktopSidebarOpen: vi.fn(),
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

  it("does not render Thought Process block when assistant message has no reasoning", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Thought Process")).not.toBeInTheDocument();
  });

  it("shows the Thought Process block when an assistant message has reasoning", () => {
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

    expect(screen.getByText("Thought Process")).toBeInTheDocument();
    expect(screen.getByText("Let me think...")).toBeInTheDocument();
  });
});
