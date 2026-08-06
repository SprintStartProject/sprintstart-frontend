import { createContext } from "react";
import type { Chat, ChatMessage, Citation, SourceSystem } from "../features/chatbot/types";
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
     */
    sendMessage: (chatId: string | undefined, text: string, navigate: NavigateFunction) => Promise<void>;

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
};

export const ChatContext = createContext<ChatContextValue | undefined>(undefined);
