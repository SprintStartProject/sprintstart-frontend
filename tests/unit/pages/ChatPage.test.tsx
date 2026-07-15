import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ChatPage } from '../../../src/pages/ChatPage';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({
        profile: { id: 'u1', firstName: 'Test', lastName: 'User', profileIcon: null },
    }),
}));

const mockHandleSubmit = vi.fn();
const mockSetNewRequest = vi.fn();
const mockSetSelectedCitation = vi.fn();

const mockChatState = {
    messages: [
        { id: 'm1', role: 'USER' as const, content: 'Hello bot', chat: undefined },
        {
            id: 'm2',
            role: 'ASSISTANT' as const,
            content: 'Hi there',
            chat: undefined,
            citations: [
                { chunk_id: 'c1', filename: 'readme.md', section_path: '/docs/readme.md#setup' },
            ],
        },
    ],
    chatId: 'chat1',
    chats: [{ id: 'chat1', userId: 'u1', title: 'Chat 1', createdAt: '' }],
    handleSubmit: mockHandleSubmit,
    isThinking: false,
    isStreaming: false,
    newRequest: '',
    setNewRequest: mockSetNewRequest,
    selectedCitation: null,
    setSelectedCitation: mockSetSelectedCitation,
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
    textareaRef: { current: null },
    bottomRef: { current: null },
    showBrainrot: false,
    timestamp: 0,
};

vi.mock('../../../src/features/chatbot/hooks/useChat', () => ({
    useChat: () => ({ ...mockChatState }),
}));

describe('ChatPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockChatState.newRequest = '';
        mockChatState.selectedCitation = null;
    });

    it('renders the message list with user and assistant messages', () => {
        render(<MemoryRouter><ChatPage /></MemoryRouter>);
        expect(screen.getByText('Hello bot')).toBeInTheDocument();
        expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    it('renders citation chips for assistant messages with citations', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><ChatPage /></MemoryRouter>);
        const toggleBtn = screen.getByRole('button', { name: /Quellen ·/i });
        await user.click(toggleBtn);
        expect(screen.getByText(/readme\.md/)).toBeInTheDocument();
    });

    it('renders a send textarea labeled "Message"', () => {
        render(<MemoryRouter><ChatPage /></MemoryRouter>);
        expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    });

    it('calls handleSubmit when the send button is clicked with a non-empty message', async () => {
        const user = userEvent.setup();
        mockChatState.newRequest = 'test message';
        render(<MemoryRouter><ChatPage /></MemoryRouter>);
        const sendButton = screen.getByRole('button', { name: 'Send message' });
        await user.click(sendButton);
        expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
    });
});
