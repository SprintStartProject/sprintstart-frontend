import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ChatPage } from "../../../src/pages/ChatPage.tsx";
import type { ChatMessage, ChatQueueItem } from "../../../src/features/chatbot/types.ts";
import type { DinoTurnOutcome } from "../../../src/features/chatbot/dinoOutcome.ts";

/**
 * The dino waiting-game as the chat page hosts it: focus must stay with the game while it
 * runs, the completion badge must tell the truth about how the turn ended, and switching
 * chats closes it.
 */

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", firstName: "Test", lastName: "User", profileIcon: null },
  }),
}));

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({
    selectedProjectId: "project1",
    selectedProject: { id: "project1", name: "Project Alpha" },
    hasSelectedProject: true,
  }),
}));

// The canvas game itself is not under test; its props are.
vi.mock("../../../src/features/chatbot/components/DinoGame", () => ({
  DinoGame: ({
    onExit,
    replyReady,
    completionLabel,
  }: {
    onExit: () => void;
    replyReady?: boolean;
    completionLabel?: string;
  }) => (
    <div
      data-testid="dino-game"
      data-reply-ready={String(Boolean(replyReady))}
      data-completion-label={completionLabel ?? ""}
    >
      <button type="button" onClick={onExit}>
        Exit Game
      </button>
    </div>
  ),
}));

const mockChatState = {
  messages: [
    { id: "m1", role: "USER" as const, content: "Hello bot", chat: undefined },
  ] as ChatMessage[],
  chatId: "chat1" as string | undefined,
  activeChat: { id: "chat1", userId: "u1", projectId: "project1", title: "Chat 1", createdAt: "" },
  chats: [{ id: "chat1", userId: "u1", projectId: "project1", title: "Chat 1", createdAt: "" }],
  handleSubmit: vi.fn(),
  hasProject: true,
  addMessage: vi.fn(),
  isThinking: true,
  isStreaming: false,
  thinkingState: null,
  streamingMessageId: null,
  turnOutcome: null as DinoTurnOutcome,
  newRequest: "",
  setNewRequest: vi.fn(),
  selectedCitation: null,
  setSelectedCitation: vi.fn(),
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
  queuedMessages: [] as ChatQueueItem[],
  queuePaused: false,
  removeQueuedMessage: vi.fn(),
  editQueuedMessage: vi.fn(),
  sendQueuedNow: vi.fn(),
};

vi.mock("../../../src/features/chatbot/hooks/useChat", () => ({
  useChat: () => ({ ...mockChatState }),
}));

function ui() {
  return (
    <MemoryRouter>
      <ChatPage />
    </MemoryRouter>
  );
}

function openGame() {
  const view = render(ui());
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true }));
  });
  expect(screen.getByTestId("dino-game")).toBeInTheDocument();
  return view;
}

describe("ChatPage dino waiting-game", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    localStorage.setItem("dinoUnlocked", "true");
    mockChatState.chatId = "chat1";
    mockChatState.isThinking = true;
    mockChatState.isStreaming = false;
    mockChatState.turnOutcome = null;
    mockChatState.textareaRef = { current: null };
    (document.activeElement as HTMLElement | null)?.blur();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("keeps focus off the composer when the reply lands mid-game, and returns it on close", () => {
    const { rerender } = openGame();
    const composer = screen.getByLabelText("Message");

    mockChatState.isThinking = false;
    mockChatState.turnOutcome = "done";
    rerender(ui());

    // The game still owns the keyboard.
    expect(document.activeElement).not.toBe(composer);
    expect(screen.getByTestId("dino-game")).toHaveAttribute("data-reply-ready", "true");
    expect(screen.getByTestId("dino-game")).toHaveAttribute("data-completion-label", "");

    fireEvent.click(screen.getByRole("button", { name: "Exit Game" }));
    expect(screen.queryByTestId("dino-game")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(composer);
  });

  it("says the turn was stopped, not that a reply is ready", () => {
    const { rerender } = openGame();
    mockChatState.isThinking = false;
    mockChatState.turnOutcome = "stopped";
    rerender(ui());
    expect(screen.getByTestId("dino-game")).toHaveAttribute("data-completion-label", "Stopped");
  });

  it("says the reply failed after a stream error", () => {
    const { rerender } = openGame();
    mockChatState.isThinking = false;
    mockChatState.turnOutcome = "failed";
    rerender(ui());
    expect(screen.getByTestId("dino-game")).toHaveAttribute(
      "data-completion-label",
      "Reply failed",
    );
  });

  it("closes the game when switching chats", () => {
    const { rerender } = openGame();
    mockChatState.chatId = "chat2";
    rerender(ui());
    expect(screen.queryByTestId("dino-game")).not.toBeInTheDocument();
  });
});
