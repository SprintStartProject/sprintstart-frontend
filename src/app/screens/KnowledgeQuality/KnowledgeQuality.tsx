import { motion } from 'motion/react';
import {
  TrendingUp,
  FileCheck,
  RefreshCw,
  Search,
  ChevronRight,
  Sparkles,
  BarChart3,
  Layers,
  FileWarning,
  Clock,
} from 'lucide-react';
import { useState } from 'react';

interface ContentItem {
  id: string;
  title: string;
  type: 'Documentation' | 'Runbook' | 'ADR' | 'Guide';
  freshness: number; // 0 to 100
  views: number;
  lastUpdated: string;
  status: 'Healthy' | 'Stale' | 'Critical';
  owner: string;
}

const MOCK_CONTENT: ContentItem[] = [
  {
    id: '1',
    title: 'Onboarding Guide: Platform',
    type: 'Guide',
    freshness: 92,
    views: 1240,
    lastUpdated: '2 days ago',
    status: 'Healthy',
    owner: 'Sarah Chen',
  },
  {
    id: '2',
    title: 'Production Incident Response',
    type: 'Runbook',
    freshness: 45,
    views: 850,
    lastUpdated: '4 months ago',
    status: 'Stale',
    owner: 'Marcus Johnson',
  },
  {
    id: '3',
    title: 'Backend Authentication ADR',
    type: 'ADR',
    freshness: 15,
    views: 420,
    lastUpdated: '1 year ago',
    status: 'Critical',
    owner: 'Emma Wilson',
  },
  {
    id: '4',
    title: 'Database Migration Strategy',
    type: 'Documentation',
    freshness: 88,
    views: 610,
    lastUpdated: '1 week ago',
    status: 'Healthy',
    owner: 'David Park',
  },
  {
    id: '5',
    title: 'CI/CD Pipeline Troubleshooting',
    type: 'Runbook',
    freshness: 62,
    views: 320,
    lastUpdated: '2 months ago',
    status: 'Stale',
    owner: 'Sarah Chen',
  },
];

export default function KnowledgeQuality() {
  const [filter, setFilter] = useState<'all' | 'Healthy' | 'Stale' | 'Critical'>('all');

  const filteredContent = MOCK_CONTENT.filter((item) => filter === 'all' || item.status === filter);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <header className="px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Knowledge Quality
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Monitoring the health of your team&apos;s collective intelligence
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-200 dark:shadow-none">
            <RefreshCw className="w-4 h-4" />
            Recalculate Health
          </button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Health Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              label: 'Avg Freshness',
              value: '74%',
              icon: TrendingUp,
              color: 'text-blue-600',
              bg: 'bg-blue-50 dark:bg-blue-900/20',
            },
            {
              label: 'Stale Items',
              value: '12',
              icon: Clock,
              color: 'text-amber-600',
              bg: 'bg-amber-50 dark:bg-amber-900/20',
            },
            {
              label: 'Critical Debt',
              value: '5',
              icon: FileWarning,
              color: 'text-red-600',
              bg: 'bg-red-50 dark:bg-red-900/20',
            },
            {
              label: 'Verified Docs',
              value: '142',
              icon: FileCheck,
              color: 'text-green-600',
              bg: 'bg-green-50 dark:bg-green-900/20',
            },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
            >
              <div
                className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-4`}
              >
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {stat.label}
              </p>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex gap-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-xl">
            {['all', 'Healthy', 'Stale', 'Critical'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  filter === f
                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm border border-gray-200 dark:border-gray-600'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title or owner..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-600 rounded-xl text-sm outline-none transition-all"
            />
          </div>
        </div>

        {/* Content Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Resource
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Freshness
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Activity
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Owner
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredContent.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          item.status === 'Healthy'
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-600'
                            : item.status === 'Stale'
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                              : 'bg-red-50 dark:bg-red-900/20 text-red-600'
                        }`}
                      >
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {item.title}
                        </p>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                          {item.type}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="w-full max-w-[120px]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[10px] font-bold ${
                            item.freshness > 80
                              ? 'text-green-600'
                              : item.freshness > 50
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {item.freshness}%
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Updated {item.lastUpdated}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.freshness}%` }}
                          className={`h-full ${
                            item.freshness > 80
                              ? 'bg-green-500'
                              : item.freshness > 50
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                          }`}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                          {item.views}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[8px] font-bold text-blue-600">
                        {item.owner
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {item.owner}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 rounded-lg text-xs font-bold transition-all group-hover:shadow-md">
                      Update
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
