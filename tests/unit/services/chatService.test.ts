import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getChats, createChat, streamMessage } from '../../../src/services/chatService';

describe('chatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it('getChats: fetches chats from API', async () => {
    const mockChats = { chats: [{ id: '1', title: 'Test Chat' }] };
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockChats),
    });

    const result = await getChats();
    
    expect(result).toEqual(mockChats);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/chats', expect.any(Object));
  });

  it('createChat: sends POST request to create chat', async () => {
    const mockChat = { id: 'new-id', title: 'New Chat' };
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockChat),
    });

    const result = await createChat('user-1');
    
    expect(result).toEqual(mockChat);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/chats', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ userId: 'user-1' })
    }));
  });

  it('streamMessage: processes stream tokens and citations', async () => {
    const mockHandlers = {
      onToken: vi.fn(),
      onCitation: vi.fn(),
      onDone: vi.fn(),
    };

    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type": "token", "content": "Hello"}\n'));
        controller.enqueue(new TextEncoder().encode('data: {"type": "citation", "chunk_id": "c1", "filename": "test.md"}\n'));
        controller.enqueue(new TextEncoder().encode('data: {"type": "done"}\n'));
        controller.close();
      },
    });

    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      body: mockStream,
    });

    await streamMessage('real-chat-1', 'hi', mockHandlers);

    expect(mockHandlers.onToken).toHaveBeenCalledWith('Hello');
    expect(mockHandlers.onCitation).toHaveBeenCalledWith({
      chunk_id: 'c1',
      filename: 'test.md',
      section_path: '',
    });
    expect(mockHandlers.onDone).toHaveBeenCalled();
  });
});
