import { motion } from 'motion/react';
import {
  Database,
  RefreshCcw,
  Plus,
  Slack,
  Github,
  Info,
  Settings2,
  Trash2,
  Layers,
} from 'lucide-react';

interface DataSource {
  id: string;
  name: string;
  type: 'Slack' | 'GitHub' | 'Confluence' | 'Jira' | 'Custom';
  status: 'Connected' | 'Syncing' | 'Error' | 'Paused';
  lastSync: string;
  itemsProcessed: number;
  health: number;
}

const MOCK_SOURCES: DataSource[] = [
  {
    id: '1',
    name: 'Engineering Workspace',
    type: 'Slack',
    status: 'Connected',
    lastSync: '10m ago',
    itemsProcessed: 42500,
    health: 98,
  },
  {
    id: '2',
    name: 'SprintStart Core',
    type: 'GitHub',
    status: 'Syncing',
    lastSync: 'Now',
    itemsProcessed: 1240,
    health: 100,
  },
  {
    id: '3',
    name: 'Team Runbooks',
    type: 'Confluence',
    status: 'Error',
    lastSync: '2h ago',
    itemsProcessed: 850,
    health: 45,
  },
  {
    id: '4',
    name: 'Project Alpha Board',
    type: 'Jira',
    status: 'Connected',
    lastSync: '1h ago',
    itemsProcessed: 320,
    health: 92,
  },
];

export default function DataIngestion() {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <header className="px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Data Ingestion
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Manage and monitor the data sources feeding the SprintStart AI engine
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md">
            <Plus className="w-4 h-4" />
            Connect Source
          </button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Source Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {MOCK_SOURCES.map((source, i) => (
            <motion.div
              key={source.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm group hover:border-blue-400 transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    source.type === 'Slack'
                      ? 'bg-[#4A154B]/10 text-[#4A154B]'
                      : source.type === 'GitHub'
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                        : source.type === 'Confluence'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {source.type === 'Slack' && <Slack className="w-6 h-6" />}
                  {source.type === 'GitHub' && <Github className="w-6 h-6" />}
                  {source.type === 'Confluence' && <Layers className="w-6 h-6" />}
                  {source.type === 'Jira' && <Info className="w-6 h-6" />}
                </div>
                <div
                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    source.status === 'Connected'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-600'
                      : source.status === 'Syncing'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                        : source.status === 'Error'
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-400'
                  }`}
                >
                  {source.status}
                </div>
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white mb-1 truncate">
                {source.name}
              </h3>
              <p className="text-xs text-gray-500 mb-4">{source.type} Integration</p>

              <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-gray-400 uppercase tracking-widest">Health</span>
                  <span className={source.health > 80 ? 'text-green-600' : 'text-red-600'}>
                    {source.health}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-gray-50 dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${source.health}%` }}
                    className={`h-full ${source.health > 80 ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span>{source.itemsProcessed.toLocaleString()} Items</span>
                  <span>{source.lastSync}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 rounded-xl transition-colors">
                  <Settings2 className="w-4 h-4 mx-auto text-gray-500" />
                </button>
                <button className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4 mx-auto" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sync History / Queue */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">
              Live Ingestion Queue
            </h3>
            <div className="flex items-center gap-2 text-blue-600 animate-pulse">
              <RefreshCcw className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Processing...</span>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-8 py-4 flex items-center gap-6">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Vectorizing: Slack Message Thread #eng-release
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Chunking 14 messages • Embeddings: text-embedding-3-small
                  </p>
                </div>
                <div className="w-32">
                  <div className="h-1.5 w-full bg-gray-50 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ x: [-100, 200] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="w-1/3 h-full bg-blue-600"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
