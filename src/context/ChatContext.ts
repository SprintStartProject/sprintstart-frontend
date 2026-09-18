import { createContext } from "react";
import type {
  Chat,
  ChatMessage,
  ChatQueueItem,
  Citation,
  SourceSystem,
} from "../features/chatbot/types";
import type { NavigateFunction } from "react-router-dom";

type MessagesByChat = Record<string, ChatMessage[]>;

/**
 * A citation selected by the user, paired with the screen-space bounding rect
 * of the element they clicked (e.g. a `[1]` superscript). The rect lets the
 * popover position itself near the click instead of at a hardcoded location.
 */
export type SelectedCitation = {
  citation: Citation;
  rect: DOMRect;
};

/**
 * The shape of the global chat context. This state lives in a provider at the
 * app root so it survives navigation — the AI stream continues in the
 * background even when the user leaves the chat page and returns later.
 */
export type ChatContextValue = {
  chats: Chat[];
  sortedChats: Chat[];

  /**
   * The project `chats` was loaded for, or `null` while a load is pending. Lets consumers
   * distinguish "this project has no such chat" from "the list has not arrived yet".
   */
  chatsProjectId: string | null;

  /** The globally selected project, mirrored here so chat consumers need only one context. */
  selectedProjectId: string;
  messagesByChat: MessagesByChat;

  isThinking: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  thinkingState: string | null;

  /**
   * The chat the in-flight stream belongs to, or `null` when nothing is
   * running. The four flags above are global (only one stream runs at a
   * time), so consumers MUST gate them on this id — otherwise the thinking
   * indicator, the composer's busy state and the stop button leak into
   * whatever chat the user has since navigated to. `useChat` does this
   * gating; prefer its derived values over reading the raw flags here.
   */
  streamingChatId: string | null;

  selectedCitation: SelectedCitation | null;
  setSelectedCitation: (value: SelectedCitation | null) => void;

  newRequest: string;
  setNewRequest: (value: string) => void;

  /**
   * Registers a callback to focus the composer textarea and place the caret at the end.
   * Called by useChat when mounted, cleaned up on unmount.
   */
  registerFocusComposer: (fn: () => void) => () => void;

  /**
   * Quotes the selected AI message text into the chat composer as a Markdown blockquote,
   * focuses the textarea, and places the caret at the end.
   */
  quoteSelection: (text: string) => void;

  showFilters: boolean;
  setShowFilters: (value: boolean | ((prev: boolean) => boolean)) => void;

  from: string;
  setFrom: (value: string) => void;

  to: string;
  setTo: (value: string) => void;

  sourceSystems: SourceSystem[];
  toggleSourceSystem: (source: SourceSystem) => void;

  activeFilterCount: number;
  clearFilters: () => void;

  /**
   * Loads messages for a chat from the backend (if not already cached in
   * `messagesByChat`). Called by the `useChat` hook when a chat is opened.
   */
  loadMessages: (chatId: string) => Promise<void>;

  /**
   * Sends a user message and streams the AI response. Takes the routing
   * `chatId` and `navigate` as parameters so the provider itself has no
   * router dependency and stays mounted across route changes.
   *
   * Starts a turn unconditionally — a caller that wants the queueing behaviour
   * the chat UI has should use {@link submitMessage} instead.
   */
  sendMessage: (
    chatId: string | undefined,
    text: string,
    navigate: NavigateFunction,
  ) => Promise<void>;

  /**
   * The composer's entry point: sends `text`, or queues it when this chat is
   * already being answered.
   *
   * This is the "send a follow-up mid-answer" path, and it never cuts the
   * running answer off. The one exception is a message submitted into a
   * *different* chat while one is streaming: the queue only drains per chat, so
   * that would otherwise sit forever — the running turn is settled instead and
   * a toast says so.
   */
  submitMessage: (chatId: string | undefined, text: string, navigate: NavigateFunction) => void;

  /**
   * Messages waiting behind a running answer, oldest first — for every chat, so
   * a consumer must filter by the chat it is showing. The provider drains each
   * one into its own chat as that chat's turn finishes.
   */
  queue: ChatQueueItem[];

  /**
   * True when the user pressed Stop with messages still queued: the queue holds
   * until {@link resumeQueue} (or the next thing they send), so a Stop means
   * "stop doing things", not "and now send the rest".
   */
  queuePaused: boolean;

  /**
   * Drops one queued message. Used by the "remove" control in the queue strip.
   */
  removeQueuedMessage: (id: string) => void;

  /**
   * Removes a queued message and returns its text, so the composer can take it
   * back for editing. Returns `null` if the id is unknown (already sent).
   */
  pullQueuedMessage: (id: string) => string | null;

  /**
   * Un-pauses the queue and sends the oldest queued message — the "Send queued"
   * button that appears once Stop has held the queue back.
   */
  resumeQueue: (navigate: NavigateFunction) => void;

  /**
   * Aborts the in-flight chat stream (if any). The partial content already
   * streamed stays visible — this is a clean stop, not an error. Called by
   * the "Stop" button in the chat UI.
   */
  stopStreaming: () => void;

  /**
   * Refreshes the chat list from the backend. Called internally after a
   * stream finishes; also exposed so the hook can call it on mount.
   */
  refreshChats: () => Promise<void>;

  /**
   * Deletes a chat conversation and all of its messages for the authenticated user,
   * cleaning up associated state and drafts.
   */
  deleteChat: (chatId: string) => Promise<void>;
};

export const ChatContext = createContext<ChatContextValue | undefined>(undefined);
