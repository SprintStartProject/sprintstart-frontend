import { useState } from 'react';
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
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Handover & Knowledge Retention
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Critical knowledge, runbooks, and ownership documentation
            </p>
          </div>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Handover Pack
          </button>
        </div>
      </div>

      {/* Alerts */}
      {criticalItems.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-900 dark:text-red-300 mb-1">
                Critical Handover Required
              </h3>
              <p className="text-sm text-red-800 dark:text-red-400">
                {criticalItems.length} {criticalItems.length === 1 ? 'item needs' : 'items need'}{' '}
                immediate attention due to ownership changes or knowledge gaps.
              </p>
            </div>
          </div>
        </div>
      )}

      {staleItems.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-1">
                Stale Documentation
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-400">
                {staleItems.length} {staleItems.length === 1 ? 'document' : 'documents'} not updated
                recently and may need review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Items</p>
          </div>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">{items.length}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Current</p>
          </div>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            {items.filter((i) => i.status === 'current').length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Stale</p>
          </div>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            {staleItems.length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Critical</p>
          </div>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            {criticalItems.length}
          </p>
        </div>
      </div>

      {/* Categories */}
      <div className="mb-6">
        <div className="flex gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {category === 'all' ? 'All Items' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <FileText className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-xs rounded capitalize ${getStatusColor(
                        item.status,
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {item.owner}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Updated {item.lastUpdated}
                    </div>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
                      {item.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
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
              </div>
              <button className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors">
                View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
