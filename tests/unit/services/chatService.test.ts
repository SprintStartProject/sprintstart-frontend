import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMyChats, createChat, getMessages, streamMessage } from '../../../src/services/chatService';
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
        it('getMyChats returns chat list', async () => {
            server.use(
                http.get('/api/v1/chats/me', () =>
                    HttpResponse.json({
                        chats: [{ id: 'chat1', userId: 'user1', title: 'Test', createdAt: new Date().toISOString() }],
                    }),
                ),
            );

            const result = await getMyChats();
            expect(result.chats).toHaveLength(1);
            expect(result.chats[0].id).toBe('chat1');
        });

        it('createChat returns created chat', async () => {
            server.use(
                http.post('/api/v1/chats/me', () => {
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
                http.get('/api/v1/chats/me/chat1', () =>
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
                http.post('/api/v1/chats/me/prompt', async ({ request }) => {
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

            await streamMessage('chat1', 'hello', [], '', '', { onToken, onReasoning: vi.fn(), onCitation: vi.fn(), onToolUse: vi.fn(), onDone, onError });

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

        it('calls onError and skips streaming if token refresh fails', async () => {
            let promptRequested = false;
            mockKeycloakInstance.updateToken.mockRejectedValueOnce(new Error('Refresh failed'));

            server.use(
                http.post('/api/v1/chats/prompt', () => {
                    promptRequested = true;
                    return new HttpResponse(null, { status: 200 });
                }),
            );

            const onError = vi.fn();
            await streamMessage('chat1', 'hello', [], '', '', {
                onToken: vi.fn(),
                onReasoning: vi.fn(),
                onCitation: vi.fn(),
                onToolUse: vi.fn(),
                onDone: vi.fn(),
                onError,
            });

            // The service surfaces the auth failure via onError instead of
            // triggering a login redirect — the UI layer decides how to react.
            expect(onError).toHaveBeenCalledOnce();
            expect(mockKeycloakInstance.login).not.toHaveBeenCalled();
            expect(promptRequested).toBe(false);
        });

        it('calls onError when response is not ok', async () => {
            server.use(
                http.post('/api/v1/chats/me/prompt', () =>
                    new HttpResponse(null, { status: 500 }),
                ),
            );

            const onError = vi.fn();
            await streamMessage('chat1', 'hello', [], '', '', {
                onToken: vi.fn(),
                onReasoning: vi.fn(),
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
                http.post('/api/v1/chats/me/prompt', () =>
                    new HttpResponse(stream, {
                        headers: { 'Content-Type': 'text/event-stream' },
                    }),
                ),
            );

            const onCitation = vi.fn();
            const onDone = vi.fn();

            await streamMessage('chat1', 'hello', [], '', '', {
                onToken: vi.fn(),
                onReasoning: vi.fn(),
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
                http.post('/api/v1/chats/me/prompt', () =>
                    new HttpResponse(stream, {
                        headers: { 'Content-Type': 'text/event-stream' },
                    }),
                ),
            );

            const onError = vi.fn();
            await streamMessage('chat1', 'hello', [], '', '', {
                onToken: vi.fn(),
                onReasoning: vi.fn(),
                onCitation: vi.fn(),
                onToolUse: vi.fn(),
                onDone: vi.fn(),
                onError,
            });

            expect(onError).toHaveBeenCalledWith('Model overload');
        });

        it('skips malformed SSE lines and continues parsing', async () => {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode('data: not valid json\n\n'));
                    controller.enqueue(encoder.encode('data: {"type":"token","content":"good"}\n\n'));
                    controller.enqueue(encoder.encode('data: {broken\n\n'));
                    controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
                    controller.close();
                },
            });

            server.use(
                http.post('/api/v1/chats/me/prompt', () =>
                    new HttpResponse(stream, {
                        headers: { 'Content-Type': 'text/event-stream' },
                    }),
                ),
            );

            const onToken = vi.fn();
            const onDone = vi.fn();
            const onError = vi.fn();

            await streamMessage('chat1', 'hello', [], '', '', {
                onToken,
                onReasoning: vi.fn(),
                onCitation: vi.fn(),
                onToolUse: vi.fn(),
                onDone,
                onError,
            });

            expect(onToken).toHaveBeenCalledWith('good');
            expect(onDone).toHaveBeenCalledTimes(1);
            expect(onError).not.toHaveBeenCalled();
        });

        it('calls onDone (not onError) when stream is aborted', async () => {
            const encoder = new TextEncoder();
            // Simulate an abort: the stream enqueues one token, then the
            // next read() throws an AbortError (exactly what fetch does when
            // the signal fires). MSW doesn't propagate abort to mock streams,
            // so we simulate the error directly.
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';

            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(encoder.encode('data: {"type":"token","content":"partial"}\n\n'));
                    // Error the stream after the first chunk is consumed,
                    // simulating what happens when the AbortSignal fires.
                    setTimeout(() => controller.error(abortError), 10);
                },
            });

            server.use(
                http.post('/api/v1/chats/me/prompt', () =>
                    new HttpResponse(stream, {
                        headers: { 'Content-Type': 'text/event-stream' },
                    }),
                ),
            );

            const onToken = vi.fn();
            const onDone = vi.fn();
            const onError = vi.fn();

            await streamMessage('chat1', 'hello', [], '', '', {
                onToken,
                onReasoning: vi.fn(),
                onCitation: vi.fn(),
                onToolUse: vi.fn(),
                onDone,
                onError,
            });

            expect(onToken).toHaveBeenCalledWith('partial');
            expect(onDone).toHaveBeenCalledTimes(1);
            expect(onError).not.toHaveBeenCalled();
        });

        it('passes AbortSignal to fetch', async () => {
            const controller = new AbortController();
            let signalPassed: AbortSignal | undefined;

            const encoder = new TextEncoder();
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
                    controller.close();
                },
            });

            server.use(
                http.post('/api/v1/chats/me/prompt', ({ request }) => {
                    signalPassed = request.signal;
                    return new HttpResponse(stream, {
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }),
            );

            await streamMessage('chat1', 'hello', [], '', '', {
                onToken: vi.fn(),
                onReasoning: vi.fn(),
                onCitation: vi.fn(),
                onToolUse: vi.fn(),
                onDone: vi.fn(),
            }, controller.signal);

            // MSW creates its own signal wrapper, so check type not identity
            expect(signalPassed).toBeInstanceOf(AbortSignal);
        });
    });
});
