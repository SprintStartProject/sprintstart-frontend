import { useState } from 'react';
import { Search, Filter, FileText, Calendar, User, Star, ExternalLink, Tag } from 'lucide-react';

interface KnowledgeItem {
  id: string;
  title: string;
  type: 'Documentation' | 'ADR' | 'Runbook' | 'Guide';
  owner: string;
  lastUpdated: string;
  freshness: 'current' | 'stale' | 'outdated';
  canonical: boolean;
  tags: string[];
  excerpt: string;
}

export function Knowledge() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedFreshness, setSelectedFreshness] = useState('all');
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);

  const items: KnowledgeItem[] = [
    {
      id: '1',
      title: 'API Authentication Guide',
      type: 'Documentation',
      owner: 'Sarah Chen',
      lastUpdated: '2026-04-15',
      freshness: 'current',
      canonical: true,
      tags: ['authentication', 'api', 'security'],
      excerpt: 'Complete guide to implementing authentication in our API using JWT tokens...',
    },
    {
      id: '2',
      title: 'Choosing React Over Vue',
      type: 'ADR',
      owner: 'Marcus Johnson',
      lastUpdated: '2026-03-22',
      freshness: 'current',
      canonical: true,
      tags: ['architecture', 'frontend', 'decision'],
      excerpt:
        'Architecture decision record for selecting React as our primary frontend framework...',
    },
    {
      id: '3',
      title: 'Database Migration Runbook',
      type: 'Runbook',
      owner: 'Emma Wilson',
      lastUpdated: '2026-04-01',
      freshness: 'current',
      canonical: true,
      tags: ['database', 'operations', 'migration'],
      excerpt: 'Step-by-step process for safely executing database schema migrations...',
    },
    {
      id: '4',
      title: 'CI/CD Pipeline Setup',
      type: 'Guide',
      owner: 'David Park',
      lastUpdated: '2026-02-10',
      freshness: 'stale',
      canonical: false,
      tags: ['ci-cd', 'deployment', 'automation'],
      excerpt: 'Guide for setting up continuous integration and deployment pipelines...',
    },
    {
      id: '5',
      title: 'Legacy Deployment Process',
      type: 'Documentation',
      owner: 'Alex Kim',
      lastUpdated: '2025-11-15',
      freshness: 'outdated',
      canonical: false,
      tags: ['deployment', 'legacy'],
      excerpt: 'Documentation for the old deployment process (deprecated)...',
    },
    {
      id: '6',
      title: 'Error Handling Best Practices',
      type: 'Documentation',
      owner: 'Sarah Chen',
      lastUpdated: '2026-04-20',
      freshness: 'current',
      canonical: true,
      tags: ['error-handling', 'best-practices'],
      excerpt: 'Guidelines for implementing consistent error handling across services...',
    },
  ];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || item.type === selectedType;
    const matchesFreshness = selectedFreshness === 'all' || item.freshness === selectedFreshness;
    return matchesSearch && matchesType && matchesFreshness;
  });

  const types = ['all', 'Documentation', 'ADR', 'Runbook', 'Guide'];
  const freshnessOptions = [
    { value: 'all', label: 'All' },
    { value: 'current', label: 'Current' },
    { value: 'stale', label: 'Stale' },
    { value: 'outdated', label: 'Outdated' },
  ];

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

  return (
    <div className="h-full flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Knowledge Explorer
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Search and browse team documentation and artifacts
          </p>
        </div>

        {/* Search & Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search knowledge base..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
              Search
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Type:</span>
              <div className="flex gap-2">
                {types.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      selectedType === type
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {type === 'all' ? 'All Types' : type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Freshness:</span>
              <div className="flex gap-2">
                {freshnessOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedFreshness(option.value)}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      selectedFreshness === option.value
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-950">
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}
            </p>
          </div>
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`bg-white dark:bg-gray-900 border rounded-lg p-5 cursor-pointer transition-all hover:shadow-md ${
                  selectedItem?.id === item.id
                    ? 'border-blue-500 dark:border-blue-500 shadow-md'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-medium text-gray-900 dark:text-white">
                          {item.title}
                        </h3>
                        {item.canonical && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {item.excerpt}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          {item.owner}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {item.lastUpdated}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full ${getFreshnessColor(item.freshness)}`}
                        >
                          {item.freshness}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded">
                    {item.type}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      {selectedItem && (
        <aside className="w-96 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedItem.title}
              </h3>
              <ExternalLink className="w-5 h-5 text-blue-600 dark:text-blue-400 cursor-pointer" />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded">
                {selectedItem.type}
              </span>
              {selectedItem.canonical && (
                <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 text-xs rounded flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Canonical
                </span>
              )}
              <span
                className={`px-2 py-1 text-xs rounded ${getFreshnessColor(selectedItem.freshness)}`}
              >
                {selectedItem.freshness}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Metadata</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Owner</span>
                    <span className="text-gray-900 dark:text-white">{selectedItem.owner}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Last Updated</span>
                    <span className="text-gray-900 dark:text-white">
                      {selectedItem.lastUpdated}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Preview</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {selectedItem.excerpt}
                </p>
              </div>

              <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
                Open Full Document
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
