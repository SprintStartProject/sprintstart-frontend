import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, AlertTriangle, User, Calendar, CheckCircle, Tag } from 'lucide-react';

interface HandoverItem {
  id: string;
  title: string;
  type: 'Runbook' | 'ADR' | 'Ownership Doc' | 'Process Guide';
  owner: string;
  lastUpdated: string;
  status: 'current' | 'stale' | 'critical';
  tags: string[];
  description: string;
}

export function Handover() {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const items: HandoverItem[] = [
    {
      id: '1',
      title: 'API Gateway Deployment Runbook',
      type: 'Runbook',
      owner: 'Sarah Chen',
      lastUpdated: '2026-04-15',
      status: 'current',
      tags: ['deployment', 'api', 'production'],
      description: 'Complete deployment procedure for API Gateway including rollback steps',
    },
    {
      id: '2',
      title: 'ADR: Migration to Microservices',
      type: 'ADR',
      owner: 'Marcus Johnson',
      lastUpdated: '2026-03-22',
      status: 'current',
      tags: ['architecture', 'microservices'],
      description: 'Decision record for transitioning from monolith to microservices architecture',
    },
    {
      id: '3',
      title: 'Database Ownership & Access Control',
      type: 'Ownership Doc',
      owner: 'Emma Wilson',
      lastUpdated: '2026-04-01',
      status: 'current',
      tags: ['database', 'security', 'ownership'],
      description: 'Database schema ownership, access patterns, and permission management',
    },
    {
      id: '4',
      title: 'Legacy Authentication Process',
      type: 'Process Guide',
      owner: 'Alex Kim',
      lastUpdated: '2025-12-10',
      status: 'stale',
      tags: ['authentication', 'legacy'],
      description: 'Authentication flow for legacy systems (needs update)',
    },
    {
      id: '5',
      title: 'Critical Incident Response Protocol',
      type: 'Runbook',
      owner: 'David Park',
      lastUpdated: '2026-05-01',
      status: 'current',
      tags: ['incident', 'oncall', 'critical'],
      description: 'Step-by-step incident response and escalation procedures',
    },
    {
      id: '6',
      title: 'Payment Service Ownership',
      type: 'Ownership Doc',
      owner: 'Sarah Chen',
      lastUpdated: '2026-01-15',
      status: 'critical',
      tags: ['payments', 'ownership', 'critical'],
      description: 'Payment service ownership - owner leaving next week, needs immediate handover',
    },
  ];

  const categories = ['all', 'Runbook', 'ADR', 'Ownership Doc', 'Process Guide'];

  const filteredItems =
    selectedCategory === 'all' ? items : items.filter((item) => item.type === selectedCategory);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current':
        return 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950';
      case 'stale':
        return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-950';
      case 'critical':
        return 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950';
      default:
        return 'text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
    }
  };

  const criticalItems = items.filter((item) => item.status === 'critical');
  const staleItems = items.filter((item) => item.status === 'stale');

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              {t('handover.title')}
            </h1>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('handover.subtitle')}
            </p>
          </div>
          <button className="w-full md:w-auto px-4 py-2.5 md:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest md:normal-case md:tracking-normal">
            <Download className="w-4 h-4" />
            {t('handover.export_button')}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {criticalItems.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4 md:mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-xs md:text-sm font-bold text-red-900 dark:text-red-300 mb-1 uppercase tracking-tighter md:normal-case md:tracking-normal">
                {t('handover.critical_alert')}
              </h3>
              <p className="text-xs md:text-sm text-red-800 dark:text-red-400 leading-relaxed">
                {t(
                  criticalItems.length === 1
                    ? 'handover.items_need_attention'
                    : 'handover.items_need_attention_plural',
                  { count: criticalItems.length },
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-[10px] md:text-sm font-bold md:font-normal text-gray-400 md:text-gray-600 uppercase md:normal-case tracking-widest md:tracking-normal">
              {t('handover.stats.total')}
            </p>
          </div>
          <p className="text-xl md:text-3xl font-black md:font-semibold text-gray-900 dark:text-white">
            {items.length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            <p className="text-[10px] md:text-sm font-bold md:font-normal text-gray-400 md:text-gray-600 uppercase md:normal-case tracking-widest md:tracking-normal">
              {t('handover.stats.current')}
            </p>
          </div>
          <p className="text-xl md:text-3xl font-black md:font-semibold text-gray-900 dark:text-white">
            {items.filter((i) => i.status === 'current').length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <p className="text-[10px] md:text-sm font-bold md:font-normal text-gray-400 md:text-gray-600 uppercase md:normal-case tracking-widest md:tracking-normal">
              {t('handover.stats.stale')}
            </p>
          </div>
          <p className="text-xl md:text-3xl font-black md:font-semibold text-gray-900 dark:text-white">
            {staleItems.length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <p className="text-[10px] md:text-sm font-bold md:font-normal text-gray-400 md:text-gray-600 uppercase md:normal-case tracking-widest md:tracking-normal">
              {t('handover.stats.critical')}
            </p>
          </div>
          <p className="text-xl md:text-3xl font-black md:font-semibold text-gray-900 dark:text-white">
            {criticalItems.length}
          </p>
        </div>
      </div>

      {/* Categories */}
      <div className="mb-6 overflow-x-auto no-scrollbar pb-1">
        <div className="flex gap-2 min-w-max">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-xl text-[10px] md:text-sm font-bold md:font-medium transition-all whitespace-nowrap uppercase md:normal-case tracking-widest md:tracking-normal border-2 ${
                selectedCategory === category
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-200 dark:hover:border-gray-600'
              }`}
            >
              {category === 'all' ? t('handover.filters.all') : t(`handover.types.${category}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-3 md:space-y-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 md:p-6 hover:shadow-lg transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                <div className="p-2.5 md:p-3 bg-gray-50 dark:bg-gray-800 rounded-xl shrink-0 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 transition-colors">
                  <FileText className="w-5 h-5 md:w-6 md:h-6 text-gray-400 md:text-gray-500 group-hover:text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                    <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white truncate">
                      {item.title}
                    </h3>
                    <span
                      className={`w-fit px-2 py-0.5 text-[9px] md:text-xs font-black md:font-bold uppercase tracking-widest rounded-lg border ${getStatusColor(
                        item.status,
                      )}`}
                    >
                      {t(`handover.status.${item.status}`)}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 md:line-clamp-none">
                    {item.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 md:gap-4 text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span className="font-bold md:font-normal">{item.owner}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="font-bold md:font-normal uppercase md:normal-case tracking-tighter md:tracking-normal">
                        {item.lastUpdated}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[9px] font-black uppercase tracking-tighter rounded-md">
                      {t(`handover.types.${item.type}`)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-4">
                    <Tag className="w-3 h-3 text-gray-400" />
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-[9px] font-bold uppercase tracking-tighter rounded-md border border-blue-100 dark:border-blue-900/50"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button className="hidden sm:block px-4 py-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-xl transition-all border border-transparent hover:border-blue-200 dark:hover:border-blue-800">
                {t('handover.actions.view')}
              </button>
            </div>
            <button className="sm:hidden w-full mt-4 px-4 py-2.5 text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-xl uppercase tracking-widest border border-blue-100 dark:border-blue-900/30">
              {t('handover.actions.view_document')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
