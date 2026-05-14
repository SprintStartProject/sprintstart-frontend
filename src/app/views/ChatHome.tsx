import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Paperclip,
  Bot,
  User,
  FileText,
  ExternalLink,
  Sparkles,
  Slack,
  Github,
  Info,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ title: string; type: string; id: string }>;
  timestamp: Date;
}

const FILTERS = [
  { id: 'all', label: 'All Sources', icon: Search, key: 'all' },
  { id: 'docs', label: 'Documentation', icon: FileText, key: 'docs' },
  { id: 'tickets', label: 'Jira Tickets', icon: Info, key: 'tickets' },
  { id: 'repos', label: 'GitHub Repos', icon: Github, key: 'repos' },
  { id: 'slack', label: 'Slack', icon: Slack, key: 'slack' },
];

export function ChatHome() {
  const { t } = useTranslation();

  // Use a state to store the base time to ensure purity during render
  const [baseTime] = useState(() => Date.now());

  // Initialize messages from translations
  const initialMessages: Message[] = useMemo(() => {
    const messagesObj = t('chat.initial_messages', { returnObjects: true });
    const messagesArray = Array.isArray(messagesObj) ? messagesObj : [];

    return messagesArray.map((msg: unknown, index: number) => {
      const m = msg as Omit<Message, 'id' | 'timestamp'>;
      return {
        ...m,
        id: `initial-${index}`,
        timestamp: new Date(baseTime - (300000 - index * 60000)),
      };
    });
  }, [t, baseTime]);

  const [messages, setMessages] = useState<Message[]>(initialMessages);

  // Track the last seen initialMessages to detect changes without cascading renders
  const [lastInitialMessages, setLastInitialMessages] = useState(initialMessages);

  if (initialMessages !== lastInitialMessages) {
    setMessages(initialMessages);
    setLastInitialMessages(initialMessages);
  }

  const [input, setInput] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI Latency
    setTimeout(() => {
      const sourceLabel = t(`chat.filters.${activeFilter}`);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `${t('chat.response_prefix', { source: sourceLabel })}\n\n${t('chat.response_body')}`,
        citations: [
          { id: 'cfg-09', title: t('chat.citations.env_config'), type: 'Documentation' },
          { id: 'sec-01', title: t('chat.citations.secrets_policy'), type: 'Security' },
        ],
        timestamp: new Date(),
      };
      setIsTyping(false);
      setMessages((prev) => [...prev, assistantMessage]);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            {t('common.ai_assistant')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {t('common.querying_sources', { count: 12 })}
          </p>
        </div>
        <div className="flex -space-x-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
            >
              <User className="w-4 h-4 text-gray-400" />
            </div>
          ))}
          <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 bg-blue-600 flex items-center justify-center text-[10px] text-white font-bold">
            +5
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 space-y-8 max-w-5xl mx-auto w-full">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 md:gap-6 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-blue-600 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="w-5 h-5" />
                ) : (
                  <Bot className="w-5 h-5" />
                )}
              </div>

              {/* Message Content */}
              <div
                className={`flex flex-col space-y-2 max-w-[85%] md:max-w-[75%] ${message.role === 'user' ? 'items-end' : ''}`}
              >
                <div
                  className={`rounded-2xl px-5 py-4 shadow-sm text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* Citations */}
                {message.citations && message.citations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {message.citations.map((citation) => (
                      <button
                        key={citation.id}
                        className="group flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500" />
                        <span>{citation.title}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-600 uppercase font-bold tracking-tighter">
                          {citation.type}
                        </span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                  {message.role === 'assistant' ? 'SprintStart AI' : t('common.you')} •{' '}
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 md:gap-6"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white dark:bg-gray-800 text-blue-600 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col space-y-2">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm w-32">
                <div className="flex gap-1 justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-1.5 h-1.5 bg-blue-600 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="w-1.5 h-1.5 bg-blue-600 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="w-1.5 h-1.5 bg-blue-600 rounded-full"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-8 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 sticky bottom-0">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {FILTERS.map((filter) => {
              const Icon = filter.icon;
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-widest">
                    {t(`chat.filters.${filter.key}`)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Input Box */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Paperclip className="w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('chat.placeholder')}
              className="w-full pl-12 pr-16 py-4 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent focus:border-blue-600 focus:bg-white dark:focus:bg-gray-800 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all focus:shadow-xl focus:shadow-blue-100 dark:focus:shadow-none outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 dark:disabled:bg-gray-800 text-white rounded-xl transition-all shadow-md hover:shadow-lg disabled:shadow-none"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-[0.2em]">
            {t('chat.press_enter')} • {t('chat.ai_warning')}
          </p>
        </div>
      </div>
    </div>
  );
}
