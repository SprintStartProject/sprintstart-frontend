import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, type Mock } from 'vitest';
import { ChatPage } from '../../../src/pages/ChatPage';
import { useChat } from '../../../src/hooks/useChat';
import { BrowserRouter } from 'react-router-dom';

// Mock useChat hook
vi.mock('../../../src/hooks/useChat', () => ({
  useChat: vi.fn(),
}));

const mockUseChat = useChat as Mock;

describe('ChatPage', () => {
  const defaultMockReturn = {
    messages: [],
    chatId: null,
    chats: [],
    handleSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    isThinking: false,
    newRequest: '',
    setNewRequest: vi.fn(),
    selectedCitation: null,
    setSelectedCitation: vi.fn(),
  };

  it('renders initial welcome state when no chat is active', () => {
    mockUseChat.mockReturnValue(defaultMockReturn);

    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/How can I help you today?/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask anything about the project.../i)).toBeInTheDocument();
  });

  it('renders chat messages and citations', () => {
    mockUseChat.mockReturnValue({
      ...defaultMockReturn,
      chatId: 'test-chat-id',
      messages: [
        { role: 'USER', content: 'What is SprintStart?' },
        { 
          role: 'ASSISTANT', 
          content: 'SprintStart is an onboarding platform.',
          citations: [{ filename: 'about.md', chunk_id: 'c1', section_path: 'Intro' }]
        },
      ],
    });

    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    expect(screen.getByText('What is SprintStart?')).toBeInTheDocument();
    expect(screen.getByText('SprintStart is an onboarding platform.')).toBeInTheDocument();
    expect(screen.getByText('[1] about.md')).toBeInTheDocument();
  });

  it('opens citation details when clicking a citation badge', () => {
    const setSelectedCitation = vi.fn();
    const citation = { filename: 'setup.md', chunk_id: 'c2', section_path: 'Prerequisites' };
    
    mockUseChat.mockReturnValue({
      ...defaultMockReturn,
      chatId: 'test-chat-id',
      messages: [
        { 
          role: 'ASSISTANT', 
          content: 'Follow the setup guide.',
          citations: [citation]
        },
      ],
      setSelectedCitation,
    });

    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    const citationButton = screen.getByText('[1] setup.md');
    fireEvent.click(citationButton);

    expect(setSelectedCitation).toHaveBeenCalledWith(citation);
  });

  it('displays the citation detail panel when a citation is selected', () => {
    const citation = { filename: 'architecture.md', section_path: 'System Overview > Backend' };
    
    mockUseChat.mockReturnValue({
      ...defaultMockReturn,
      chatId: 'test-chat-id',
      selectedCitation: citation,
    });

    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    // Verify the detail panel content
    expect(screen.getByText('architecture.md')).toBeInTheDocument();
    expect(screen.getByText('System Overview > Backend')).toBeInTheDocument();
  });

  it('disables the send button while thinking', () => {
    mockUseChat.mockReturnValue({
      ...defaultMockReturn,
      isThinking: true,
      newRequest: 'Waiting...',
    });

    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    const sendButton = screen.getByRole('button', { name: '' }); // The button with the Send icon
    expect(sendButton).toBeDisabled();
  });
});
