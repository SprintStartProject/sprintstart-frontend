import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getChats, createChat, getMessages, streamMessage } from '../../../src/services/chatService';
import { http, HttpResponse } from 'msw';
import { mockKeycloakInstance, server } from '../../unit/setup/vitest.setup';

describe('chatService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockKeycloakInstance.authenticated = true;
        mockKeycloakInstance.token = 'test-token';
        mockKeycloakInstance.updateToken.mockResolvedValue(true);
    });

    describe('REST endpoints', () => {
        it('getChats returns chat list', async () => {
            server.use(
                http.get('/api/v1/chats', () =>
                    HttpResponse.json({
                        chats: [{ id: 'chat1', userId: 'user1', title: 'Test', createdAt: new Date().toISOString() }],
                    }),
                ),
            );

            const result = await getChats();
            expect(result.chats).toHaveLength(1);
            expect(result.chats[0].id).toBe('chat1');
        });

        it('createChat returns created chat', async () => {
            server.use(
                http.post('/api/v1/chats', async ({ request }) => {
                    const body = (await request.json()) as { userId: string };
                    expect(body.userId).toBe('user1');
                    return HttpResponse.json({
                        id: 'chat2',
                        userId: 'user1',
                        title: '',
                        createdAt: new Date().toISOString(),
                    });
                }),
            );

            const result = await createChat('user1');
            expect(result.id).toBe('chat2');
        });

        it('getMessages returns messages for a chat', async () => {
            server.use(
                http.get('/api/v1/chats/chat1', () =>
                    HttpResponse.json({
                        messages: [{ id: 'msg1', content: 'hello', role: 'USER', chat: null }],
                    }),
                ),
            );

            const result = await getMessages('chat1');
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].content).toBe('hello');
        });
    });

    describe('streamMessage', () => {
        it('receives tokens and done signal', async () => {
            let capturedAuthHeader: string | null = null;
            let capturedBody: unknown = null;
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode('data: {"type":"token","content":"hel"}\n\n'));
                    controller.enqueue(encoder.encode('data: {"type":"token","content":"lo"}\n\n'));
                    controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
                    controller.close();
                },
            });

            server.use(
                http.post('/api/v1/chats/prompt', async ({ request }) => {
                    capturedAuthHeader = request.headers.get('Authorization');
                    capturedBody = await request.json();
                    return new HttpResponse(stream, {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }),
            );

            const onToken = vi.fn();
            const onDone = vi.fn();
            const onError = vi.fn();

            await streamMessage('chat1', 'hello', [], '', '', { onToken, onCitation: vi.fn(), onToolUse: vi.fn(), onDone, onError });

            expect(mockKeycloakInstance.updateToken).toHaveBeenCalledWith(30);
            expect(capturedAuthHeader).toBe('Bearer test-token');
            expect(capturedBody).toEqual({
                chatId: 'chat1',
                msg: 'hello',
            });
            expect(onToken).toHaveBeenCalledTimes(2);
            expect(onToken).toHaveBeenNthCalledWith(1, 'hel');
            expect(onToken).toHaveBeenNthCalledWith(2, 'lo');
            expect(onDone).toHaveBeenCalledTimes(1);
            expect(onError).not.toHaveBeenCalled();
        });

        it('calls login and skips streaming if token refresh fails', async () => {
            let promptRequested = false;
            mockKeycloakInstance.updateToken.mockRejectedValueOnce(new Error('Refresh failed'));

            server.use(
                http.post('/api/v1/chats/prompt', () => {
                    promptRequested = true;
                    return new HttpResponse(null, { status: 200 });
                }),
            );

            await streamMessage('chat1', 'hello', [], '', '', {
                onToken: vi.fn(),
                onCitation: vi.fn(),
                onToolUse: vi.fn(),
                onDone: vi.fn(),
            });

            expect(mockKeycloakInstance.login).toHaveBeenCalledOnce();
            expect(promptRequested).toBe(false);
        });

        it('calls onError when response is not ok', async () => {
            server.use(
                http.post('/api/v1/chats/prompt', () =>
                    new HttpResponse(null, { status: 500 }),
                ),
            );

            const onError = vi.fn();
            await streamMessage('chat1', 'hello', [], '', '', {
                onToken: vi.fn(),
                onCitation: vi.fn(),
                onToolUse: vi.fn(),
                onDone: vi.fn(),
                onError,
            });

            expect(onError).toHaveBeenCalledWith('HTTP error! status: 500');
        });

        it('processes citation events', async () => {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(
                        encoder.encode(
                            'data: {"type":"citation","artifact_id":"a1","filename":"doc.txt","start_line":5}\n\n',
                        ),
                    );
                    controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
                    controller.close();
                },
            });

            server.use(
                http.post('/api/v1/chats/prompt', () =>
                    new HttpResponse(stream, {
                        headers: { 'Content-Type': 'text/event-stream' },
                    }),
                ),
            );

            const onCitation = vi.fn();
            const onDone = vi.fn();

            await streamMessage('chat1', 'hello', [], '', '', {
                onToken: vi.fn(),
                onCitation,
                onToolUse: vi.fn(),
                onDone,
            });

            expect(onCitation).toHaveBeenCalledWith({
                artifactId: 'a1',
                filename: 'doc.txt',
                sourceUrl: undefined,
                startLine: 5,
                startPage: undefined,
            });
            expect(onDone).toHaveBeenCalledTimes(1);
        });

        it('handles stream error event', async () => {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode('data: {"type":"error","message":"Model overload"}\n\n'));
                    controller.close();
                },
            });

            server.use(
                http.post('/api/v1/chats/prompt', () =>
                    new HttpResponse(stream, {
                        headers: { 'Content-Type': 'text/event-stream' },
                    }),
                ),
            );

            const onError = vi.fn();
            await streamMessage('chat1', 'hello', [], '', '', {
                onToken: vi.fn(),
                onCitation: vi.fn(),
                onToolUse: vi.fn(),
                onDone: vi.fn(),
                onError,
            });

            expect(onError).toHaveBeenCalledWith('Model overload');
        });
    });
});
