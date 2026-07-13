export type Chat = {
    id: string;
    title: string;

    /**
     * The user that created the chat.
     */
    userId: string;

    /**
     * Date the chat was created.
     */
    createdAt: string;
};

export type ChatMessage = {
    id: string;

    /**
     * Decides who the message belongs to.
     */
    role: 'ASSISTANT' | 'USER' | 'SYSTEM' | 'ORCHESTRATOR';

    /**
     * The chat where the message was posted.
     */
    chat: Chat | undefined,

    /**
     * Text content of the message.
     */
    content: string;

    /**
     * Possible citations appended to the message.
     */
    citations?: Citation[]
};

export type Citation = {
    chunk_id: string,

    /**
     * Name of the file the citation refers to.
     */
    filename: string,

    /**
     * The exact path to the file.
     */
    section_path: string
};

export type ChatSidebarProps = {
    /**
     * User-created chats displayed in the sidebar.
     */
    chats: Chat[]

    /**
     * Function that opens or closes the sidebar.
     */
    setSidebarOpen: (open: boolean) => void;
};

export type StreamHandlers = {

    /**
     * The function executed when the stream event describes a tool used for generating the answer.
     */
    onToolUse: (tool: string) => void;

    /**
     * The function executed when the stream event contains normal text.
     */
    onToken: (token: string) => void;

    /**
     * The function executed when the stream event is a citation.
     */
    onCitation: (citation: Citation) => void;

    /**
     * The function executed when the stream event marks the end of the stream.
     */
    onDone: () => void;

    /**
     * The function executed when the stream event calls an error.
     */
    onError?: (message: string) => void;
};

export const SOURCE_SYSTEMS = [
    "GITHUB",
    "JIRA",
    "UPLOAD"
] as const;

export type SourceSystem = (typeof SOURCE_SYSTEMS)[number];