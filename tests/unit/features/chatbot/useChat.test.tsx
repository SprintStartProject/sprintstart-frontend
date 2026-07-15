import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChat } from '../../../../src/features/chatbot/hooks/useChat';
import { http, HttpResponse } from 'msw';
import { server } from '../../setup/vitest.setup';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'chat1' }),
    useLocation: () => ({ pathname: '/' }),
}));

describe('useChat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    it('fetches chats and user profile on mount', async () => {
        server.use(
            http.get('/api/v1/chats', () =>
                HttpResponse.json({
                    chats: [
                        { id: 'chat1', userId: 'user1' },
                        { id: 'chat2', userId: 'user2' },
                    ],
                }),
            ),
            http.get('/api/v1/users/me', () =>
                HttpResponse.json({
                    id: 'user1',
                    authId: 'auth-1',
                    username: 'testuser',
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    projectRoles: [],
                    permissionGroup: 'USER',
                    enabled: true,
                    profileIcon: null,
                    hasCompletedOnboarding: true,
                }),
            ),
            http.get('/api/v1/chats/chat1', () =>
                HttpResponse.json({ messages: [] }),
            ),
        );

        const { result } = renderHook(() => useChat());

        await waitFor(() => {
            expect(result.current.chats).toEqual([{ id: 'chat1', userId: 'user1' }]);
        });
    });

    it('loads messages when chat is selected', async () => {
        server.use(
            http.get('/api/v1/chats', () => HttpResponse.json({ chats: [] })),
            http.get('/api/v1/chats/chat1', () =>
                HttpResponse.json({
                    messages: [
                        {
                            id: 'msg1',
                            content: 'previous message',
                            role: 'USER',
                            chat: null,
                        },
                    ],
                }),
            ),
            http.get('/api/v1/users/me', () =>
                HttpResponse.json({
                    id: 'user1',
                    authId: 'auth-1',
                    username: 'testuser',
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    projectRoles: [],
                    permissionGroup: 'USER',
                    enabled: true,
                    profileIcon: null,
                    hasCompletedOnboarding: true,
                }),
            ),
        );

        const { result } = renderHook(() => useChat());

        await waitFor(() => {
            expect(result.current.messages).toEqual([
                {
                    id: 'msg1',
                    content: 'previous message',
                    role: 'USER',
                    chat: null,
                },
            ]);
        });
    });

    it('handles streaming flow when adding a message', async () => {
        mockNavigate.mockReset();

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(
                    encoder.encode('data: {"type":"token","content":"Hello "}\n\n'),
                );
                controller.enqueue(
                    encoder.encode('data: {"type":"token","content":"world"}\n\n'),
                );
                controller.enqueue(
                    encoder.encode(
                        'data: {"type":"citation","artifact_id":"1","filename":"file.txt"}\n\n',
                    ),
                );
                controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
                controller.close();
            },
        });

        server.use(
            http.get('/api/v1/chats', () => HttpResponse.json({ chats: [] })),
            http.get('/api/v1/chats/chat1', () => HttpResponse.json({ messages: [] })),
            http.get('/api/v1/users/me', () =>
                HttpResponse.json({
                    id: 'user1',
                    authId: 'auth-1',
                    username: 'testuser',
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    projectRoles: [],
                    permissionGroup: 'USER',
                    enabled: true,
                    profileIcon: null,
                    hasCompletedOnboarding: true,
                }),
            ),
            http.post('/api/v1/chats/prompt', () =>
                new HttpResponse(stream, {
                    headers: { 'Content-Type': 'text/event-stream' },
                }),
            ),
            http.post('/api/v1/chats', () =>
                HttpResponse.json({
                    id: 'newChatId',
                    userId: 'user1',
                    title: '',
                    createdAt: new Date().toISOString(),
                }),
            ),
        );

        const { result } = renderHook(() => useChat());

        await waitFor(() => {
            expect(result.current.chats).toEqual([]);
        });

        await act(async () => {
            await result.current.addMessage('My new prompt');
        });

        await waitFor(() => {
            expect(result.current.messages.length).toBe(2);
        });

        const userMsg = result.current.messages[0];
        expect(userMsg.role).toBe('USER');
        expect(userMsg.content).toBe('My new prompt');

        const aiMsg = result.current.messages[1];
        expect(aiMsg.role).toBe('ASSISTANT');
        expect(aiMsg.content).toBe('Hello world');
        expect(aiMsg.citations?.length).toBe(1);
        expect(aiMsg.citations?.[0].filename).toBe('file.txt');
    });
});
