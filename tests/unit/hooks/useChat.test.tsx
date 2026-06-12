import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { useChat } from '../../../src/hooks/useChat';
import * as chatService from '../../../src/services/chatService';
import { useParams, useNavigate } from 'react-router-dom';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: vi.fn(),
  useNavigate: vi.fn(),
}));

// Mock chatService
vi.mock('../../../src/services/chatService', () => ({
  getChats: vi.fn(),
  getMessages: vi.fn(),
  createChat: vi.fn(),
  streamMessage: vi.fn(),
}));

describe('useChat', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as Mock).mockReturnValue({ id: undefined });
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    
    // Mock crypto.randomUUID using globalThis
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => 'test-uuid-' + Math.random(),
      },
      writable: true
    });

    (chatService.getChats as Mock).mockResolvedValue({ chats: [] });
  });

  it('loads chats on mount', async () => {
    const mockChats = [{ id: '1', title: 'Chat 1' }];
    (chatService.getChats as Mock).mockResolvedValue({ chats: mockChats });

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.chats).toEqual(mockChats);
    });
  });

  it('loads messages when chatId changes', async () => {
    const mockMessages = [{ id: 'm1', content: 'Hello', role: 'USER' }];
    (useParams as Mock).mockReturnValue({ id: 'chat-123' });
    (chatService.getMessages as Mock).mockResolvedValue({ messages: mockMessages });

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.messages).toEqual(mockMessages);
    });
    expect(chatService.getMessages).toHaveBeenCalledWith('chat-123');
  });

  it('creates a new chat and navigates if addMessage is called without chatId', async () => {
    const newChat = { id: 'new-chat-id' };
    (chatService.createChat as Mock).mockResolvedValue(newChat);
    (chatService.streamMessage as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.addMessage('Hello');
    });

    expect(chatService.createChat).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/chat/new-chat-id');
  });

  it('optimistically updates messages when sending a message', async () => {
    (useParams as Mock).mockReturnValue({ id: 'chat-123' });
    (chatService.getMessages as Mock).mockResolvedValue({ messages: [] });
    // Use a promise that we can control to simulate thinking state
    let resolveStream: (value: void) => void;
    const streamPromise = new Promise<void>((resolve) => {
      resolveStream = resolve;
    });
    (chatService.streamMessage as Mock).mockReturnValue(streamPromise);

    const { result } = renderHook(() => useChat());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.messages).toEqual([]);
    });

    await act(async () => {
      void result.current.addMessage('How are you?');
      await Promise.resolve();
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('How are you?');
    expect(result.current.isThinking).toBe(true);

    // Clean up
    await act(async () => {
      await Promise.resolve(); // Ensure microtasks run
      resolveStream!();
    });
  });

  it('updates assistant message content during streaming', async () => {
    (useParams as Mock).mockReturnValue({ id: 'chat-123' });
    (chatService.getMessages as Mock).mockResolvedValue({ messages: [] });
    
    let onTokenCallback: (token: string) => void;
    (chatService.streamMessage as Mock).mockImplementation((_id: string, _text: string, options: chatService.StreamHandlers) => {
      onTokenCallback = options.onToken;
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.messages).toEqual([]);
    });

    await act(async () => {
      await result.current.addMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);

    await act(async () => {
      onTokenCallback!('Hi');
      await Promise.resolve();
    });
    expect(result.current.messages[1].content).toBe('Hi');

    await act(async () => {
      onTokenCallback!(' there');
      await Promise.resolve();
    });
    expect(result.current.messages[1].content).toBe('Hi there');
  });
});
