import { useState } from 'react';
import { Send, Bot, User, FileText, Link2, Filter } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ title: string; type: string; date: string }>;
  timestamp: Date;
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
          "Hello! I can help you find information from your team's knowledge base. Ask me anything about your projects, documentation, or onboarding materials.",
      timestamp: new Date(),
    },
    {
      id: '2',
      role: 'user',
      content: 'How do we handle authentication in the API?',
      timestamp: new Date(),
    },
    {
      id: '3',
      role: 'assistant',
      content:
          "Based on the team documentation, authentication is handled using JWT tokens. Here's what I found:\n\n1. All API requests require an Authorization header with a Bearer token\n2. Tokens are issued by the /auth/login endpoint\n3. Token expiration is set to 24 hours\n4. Refresh tokens are available for extended sessions\n\nThe implementation details are in the API Authentication Guide.",
      sources: [
        { title: 'API Authentication Guide', type: 'Documentation', date: '2026-04-15' },
        { title: 'Backend Setup ADR', type: 'ADR', date: '2026-03-22' },
        { title: 'Security Best Practices', type: 'Runbook', date: '2026-04-01' },
      ],
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'All Sources' },
    { id: 'docs', label: 'Documentation' },
    { id: 'adr', label: 'ADRs' },
    { id: 'runbooks', label: 'Runbooks' },
    { id: 'recent', label: 'Recent' },
  ];

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInput('');

    setTimeout(() => {
      const response: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm searching through the knowledge base for relevant information...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, response]);
    }, 500);
  };

  return (
      <div className="h-full flex">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              AI Knowledge Assistant
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Ask questions about your team&apos;s knowledge and documentation
            </p>
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              {filters.map((filter) => (
                  <button
                      key={filter.id}
                      onClick={() => setActiveFilter(filter.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          activeFilter === filter.id
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                  >
                    {filter.label}
                  </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-6 space-y-6 bg-gray-50 dark:bg-gray-950">
            {messages.map((message) => (
                <div key={message.id} className="flex gap-4">
                  <div
                      className={`p-2 rounded-lg h-fit ${
                          message.role === 'user'
                              ? 'bg-blue-100 dark:bg-blue-950'
                              : 'bg-gray-200 dark:bg-gray-800'
                      }`}
                  >
                    {message.role === 'user' ? (
                        <User className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                    ) : (
                        <Bot className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                      <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                        {message.content}
                      </p>
                      {message.sources && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Sources:
                            </p>
                            <div className="space-y-2">
                              {message.sources.map((source, idx) => (
                                  <div
                                      key={idx}
                                      className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                                  >
                                    <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-900 dark:text-white">
                                        {source.title}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {source.type}
                                </span>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {source.date}
                                </span>
                                      </div>
                                    </div>
                                    <Link2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                  </div>
                              ))}
                            </div>
                          </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex gap-3">
              <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask a question about your team's knowledge..."
                  className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Related Results Panel */}
        <aside className="w-80 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Related Content</h3>
          <div className="space-y-3">
            {[
              { title: 'API Rate Limiting', type: 'Documentation', date: 'Apr 12' },
              { title: 'Error Handling Strategy', type: 'ADR', date: 'Apr 8' },
              { title: 'OAuth 2.0 Setup Guide', type: 'Runbook', date: 'Mar 28' },
              { title: 'Database Connection Pooling', type: 'Documentation', date: 'Mar 15' },
            ].map((item, idx) => (
                <div
                    key={idx}
                    className="p-3 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-600 dark:text-gray-400">{item.type}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{item.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </aside>
      </div>
  );
}