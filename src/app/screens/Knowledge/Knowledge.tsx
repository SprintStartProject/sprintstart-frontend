import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileText,
  Calendar,
  User,
  Star,
  ExternalLink,
  Tag,
  MessageSquare,
  Share2,
  RefreshCw,
  Sparkles,
  SearchX,
  ChevronRight,
} from 'lucide-react';
import { mockKnowledgeItems, KnowledgeItem } from './mockData';

export function Knowledge() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedFreshness, setSelectedFreshness] = useState('all');
  const [selectedOwner, setSelectedOwner] = useState('all');
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);

  const owners = useMemo(() => {
    const uniqueOwners = Array.from(new Set(mockKnowledgeItems.map((item) => item.owner)));
    return ['all', ...uniqueOwners];
  }, []);

  const filteredItems = mockKnowledgeItems.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || item.type === selectedType;
    const matchesFreshness = selectedFreshness === 'all' || item.freshness === selectedFreshness;
    const matchesOwner = selectedOwner === 'all' || item.owner === selectedOwner;
    return matchesSearch && matchesType && matchesFreshness && matchesOwner;
  });

  const types = ['all', 'Documentation', 'ADR', 'Runbook', 'Guide'];
  const freshnessOptions = ['all', 'current', 'stale', 'outdated'];

  const getFreshnessColor = (freshness: string) => {
    switch (freshness) {
      case 'current':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950';
      case 'stale':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-950';
      case 'outdated':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedFreshness('all');
    setSelectedOwner('all');
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('knowledge.title')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('knowledge.subtitle')}</p>
        </div>

        {/* Search & Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('knowledge.search_placeholder')}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
            </div>
            <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm active:scale-95 transform">
              {t('knowledge.search_button')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('knowledge.filters.type')}:
              </span>
              <div className="flex gap-1.5">
                {types.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      selectedType === type
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {type === 'all'
                      ? t('knowledge.filters.all_types')
                      : t(`knowledge.types.${type}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('knowledge.filters.freshness')}:
              </span>
              <div className="flex gap-1.5">
                {freshnessOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedFreshness(opt)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      selectedFreshness === opt
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt === 'all' ? t('knowledge.filters.all') : t(`knowledge.freshness.${opt}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('knowledge.filters.owner')}:
              </span>
              <select
                value={selectedOwner}
                onChange={(e) => setSelectedOwner(e.target.value)}
                className="bg-gray-100 dark:bg-gray-800 border-none rounded text-xs font-medium text-gray-700 dark:text-gray-300 py-1 px-2 focus:ring-1 focus:ring-blue-500"
              >
                {owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner === 'all' ? t('knowledge.filters.all_owners') : owner}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-950">
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t(
                filteredItems.length === 1
                  ? 'knowledge.results_count'
                  : 'knowledge.results_count_plural',
                { count: filteredItems.length },
              )}
            </p>
            {(selectedType !== 'all' ||
              selectedFreshness !== 'all' ||
              selectedOwner !== 'all' ||
              searchQuery !== '') && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t('knowledge.clear_filters')}
              </button>
            )}
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => setSelectedItem(item)}
                    className={`bg-white dark:bg-gray-900 border rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg group ${
                      selectedItem?.id === item.id
                        ? 'border-blue-500 dark:border-blue-500 shadow-md ring-1 ring-blue-500/20'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div
                          className={`p-2 rounded-lg ${selectedItem?.id === item.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors'}`}
                        >
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                              {item.title}
                            </h3>
                            {item.canonical && (
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                            {item.excerpt}
                          </p>
                          <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" />
                              {item.owner}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {item.lastUpdated}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium ${getFreshnessColor(item.freshness)}`}
                            >
                              {t(`knowledge.freshness.${item.freshness}`)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-bold uppercase tracking-tighter rounded">
                          {t(`knowledge.types.${item.type}`)}
                        </span>
                        <ChevronRight
                          className={`w-5 h-5 text-gray-300 transition-transform ${selectedItem?.id === item.id ? 'translate-x-1 text-blue-500' : 'group-hover:translate-x-1 group-hover:text-gray-400'}`}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <Tag className="w-3.5 h-3.5 text-gray-400" />
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-[10px] font-medium rounded border border-blue-100 dark:border-blue-900/50"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4">
                    <SearchX className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {t('knowledge.no_results')}
                  </h3>
                  <button
                    onClick={clearFilters}
                    className="mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                  >
                    {t('knowledge.clear_filters')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <AnimatePresence>
        {selectedItem && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-[420px] border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shadow-2xl relative z-20"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-start justify-between mb-4">
                <div className="pr-8">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                    {selectedItem.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                >
                  <ExternalLink className="w-5 h-5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold rounded">
                  {t(`knowledge.types.${selectedItem.type}`)}
                </span>
                {selectedItem.canonical && (
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    {t('knowledge.metadata.canonical')}
                  </span>
                )}
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${getFreshnessColor(selectedItem.freshness)}`}
                >
                  {t(`knowledge.freshness.${selectedItem.freshness}`)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <button className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {t('knowledge.actions.ask_ai')}
                </button>
                <button className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Share2 className="w-3.5 h-3.5" />
                  {t('knowledge.actions.share')}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-8">
              {/* AI Insight Section */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-12 h-12 text-blue-600" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-blue-600 rounded-lg">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">
                    {t('knowledge.metadata.ai_summary')}
                  </h4>
                </div>
                <p className="text-sm text-blue-800/80 dark:text-blue-200/80 leading-relaxed italic">
                  &quot;{selectedItem.aiSummary}&quot;
                </p>
                <button className="mt-4 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  {t('knowledge.actions.summarize')}
                </button>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                  {t('knowledge.metadata.owner')}
                </h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold">
                    {selectedItem.owner
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {selectedItem.owner}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('knowledge.metadata.last_updated')}: {selectedItem.lastUpdated}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                  {t('knowledge.metadata.preview')}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {selectedItem.excerpt}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                  {t('knowledge.metadata.tags')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <button className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98]">
                {t('knowledge.actions.open')}
              </button>
              <button className="w-full mt-3 px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs transition-colors">
                {t('knowledge.actions.request_update')}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
