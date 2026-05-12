import { motion } from 'motion/react';
import { Terminal, Search, ShieldAlert, Info, Download, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'security';
  service: string;
  message: string;
  user?: string;
}

const MOCK_LOGS: LogEntry[] = [
  {
    id: '1',
    timestamp: '2026-05-08 14:22:01',
    level: 'info',
    service: 'AUTH-V2',
    message: 'User sarah.chen@company.com successfully authenticated via SSO.',
    user: 'Sarah Chen',
  },
  {
    id: '2',
    timestamp: '2026-05-08 14:25:44',
    level: 'security',
    service: 'GATEWAY',
    message: 'Rate limit exceeded for IP 192.168.1.45. Request blocked.',
    user: 'Anonymous',
  },
  {
    id: '3',
    timestamp: '2026-05-08 14:28:12',
    level: 'error',
    service: 'INGESTION',
    message: 'Failed to sync Confluence space "ENGINEERING_ARCH". Connection timeout.',
    user: 'System',
  },
  {
    id: '4',
    timestamp: '2026-05-08 14:30:05',
    level: 'warn',
    service: 'SEARCH-INDEX',
    message: 'Low memory warning in vector database node-04.',
    user: 'System',
  },
  {
    id: '5',
    timestamp: '2026-05-08 14:32:19',
    level: 'info',
    service: 'AI-CORE',
    message: 'Generated citation-grounded response for query "Deployment Guide".',
    user: 'Marcus Johnson',
  },
];

export default function SystemLogs() {
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'security'>('all');

  const filteredLogs = MOCK_LOGS.filter((log) => filter === 'all' || log.level === filter);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <header className="px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-gray-600" />
              System Logs
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Real-time audit trails and system telemetry
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 transition-all hover:bg-gray-50 dark:hover:bg-gray-700">
              <Trash2 className="w-4 h-4" />
              Clear Logs
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold transition-all hover:bg-blue-700 shadow-md">
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">04</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                Errors (24h)
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl flex items-center justify-center">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">12</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                Warnings (24h)
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">1.2k</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                Requests/min
              </p>
            </div>
          </div>
        </div>

        {/* Log Viewer Control */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-x-auto w-full md:w-auto">
            {['all', 'info', 'warn', 'error', 'security'].map((l) => (
              <button
                key={l}
                onClick={() => setFilter(l as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  filter === l
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs (e.g. IP, User, Service)..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-600 rounded-xl text-sm outline-none transition-all"
            />
          </div>
        </div>

        {/* Log Stream */}
        <div className="bg-[#0d1117] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
          <div className="bg-[#161b22] px-6 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
              Live Stream - Connected
            </span>
          </div>
          <div className="p-6 font-mono text-xs overflow-x-auto space-y-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex gap-4 group">
                <span className="text-gray-500 shrink-0">{log.timestamp.split(' ')[1]}</span>
                <span
                  className={`font-bold w-20 shrink-0 ${
                    log.level === 'error'
                      ? 'text-red-500'
                      : log.level === 'warn'
                        ? 'text-amber-500'
                        : log.level === 'security'
                          ? 'text-purple-500'
                          : 'text-blue-500'
                  }`}
                >
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-green-500 shrink-0">@{log.service}</span>
                <span className="text-gray-300 group-hover:text-white transition-colors">
                  {log.message}{' '}
                  {log.user && <span className="text-gray-500 italic">({log.user})</span>}
                </span>
              </div>
            ))}
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="flex gap-4"
            >
              <span className="text-blue-500">_</span>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
