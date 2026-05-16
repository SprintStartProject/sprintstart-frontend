import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  ExternalLink,
  FileText,
  Filter,
  GitBranch,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
} from 'lucide-react';

type SourceStatus = 'connected' | 'warning' | 'failed' | 'disabled';
type ArtifactStatus = 'fresh' | 'stale' | 'failed' | 'indexed';
type RunStatus = 'success' | 'partial' | 'failed' | 'running';

interface DataSource {
  id: string;
  name: string;
  type: 'GitHub' | 'Jira' | 'Confluence' | 'SonarQube' | 'SharePoint';
  status: SourceStatus;
  scope: string;
  artifacts: number;
  lastSync: string;
  nextSync: string;
  errors: number;
  description: string;
}

interface Artifact {
  id: string;
  title: string;
  source: string;
  type: 'Documentation' | 'Ticket' | 'Repository' | 'Pull Request' | 'Code Quality' | 'Runbook';
  owner: string;
  lastUpdated: string;
  status: ArtifactStatus;
  chunks: number;
}

interface IngestionRun {
  id: string;
  source: string;
  status: RunStatus;
  startedAt: string;
  duration: string;
  created: number;
  updated: number;
  failed: number;
}

const mockSources: DataSource[] = [
  {
    id: '1',
    name: 'Frontend GitHub Repository',
    type: 'GitHub',
    status: 'connected',
    scope: 'org/sprintstart-web, org/shared-ui',
    artifacts: 428,
    lastSync: '12 minutes ago',
    nextSync: 'in 48 minutes',
    errors: 0,
    description: 'Indexes repositories, README files, pull requests, branches, and relevant source files.',
  },
  {
    id: '2',
    name: 'Jira Project Board',
    type: 'Jira',
    status: 'warning',
    scope: 'SPRINT, ONB, FE tickets',
    artifacts: 312,
    lastSync: '34 minutes ago',
    nextSync: 'in 26 minutes',
    errors: 7,
    description: 'Indexes epics, stories, tasks, comments, sprint metadata, and issue relations.',
  },
  {
    id: '3',
    name: 'Engineering Docs',
    type: 'Confluence',
    status: 'connected',
    scope: 'Architecture, Runbooks, ADRs',
    artifacts: 196,
    lastSync: '1 hour ago',
    nextSync: 'in 2 hours',
    errors: 0,
    description: 'Indexes documentation pages, headings, tables, attachments, and internal links.',
  },
  {
    id: '4',
    name: 'SonarQube Quality Reports',
    type: 'SonarQube',
    status: 'failed',
    scope: 'sprintstart-web only',
    artifacts: 64,
    lastSync: 'yesterday',
    nextSync: 'manual retry needed',
    errors: 14,
    description: 'Indexes quality gates, code smells, vulnerabilities, coverage, and duplicated code reports.',
  },
];

const mockArtifacts: Artifact[] = [
  {
    id: 'A-101',
    title: 'Frontend Setup Guide',
    source: 'Engineering Docs',
    type: 'Documentation',
    owner: 'Platform Team',
    lastUpdated: '2 days ago',
    status: 'fresh',
    chunks: 18,
  },
  {
    id: 'A-102',
    title: 'Auth Flow ADR',
    source: 'Engineering Docs',
    type: 'Runbook',
    owner: 'Security Team',
    lastUpdated: '3 weeks ago',
    status: 'indexed',
    chunks: 9,
  },
  {
    id: 'A-103',
    title: 'sprintstart-web repository',
    source: 'Frontend GitHub Repository',
    type: 'Repository',
    owner: 'Frontend Team',
    lastUpdated: '12 minutes ago',
    status: 'fresh',
    chunks: 143,
  },
  {
    id: 'A-104',
    title: 'ONB-124 Starter Issue',
    source: 'Jira Project Board',
    type: 'Ticket',
    owner: 'Anna Schmidt',
    lastUpdated: '5 days ago',
    status: 'indexed',
    chunks: 7,
  },
  {
    id: 'A-105',
    title: 'Deployment Runbook',
    source: 'Engineering Docs',
    type: 'Runbook',
    owner: 'DevOps Team',
    lastUpdated: '9 months ago',
    status: 'stale',
    chunks: 22,
  },
];

const mockRuns: IngestionRun[] = [
  {
    id: 'RUN-9821',
    source: 'Frontend GitHub Repository',
    status: 'success',
    startedAt: '12 minutes ago',
    duration: '1m 42s',
    created: 8,
    updated: 34,
    failed: 0,
  },
  {
    id: 'RUN-9820',
    source: 'Jira Project Board',
    status: 'partial',
    startedAt: '34 minutes ago',
    duration: '2m 18s',
    created: 4,
    updated: 19,
    failed: 7,
  },
  {
    id: 'RUN-9819',
    source: 'SonarQube Quality Reports',
    status: 'failed',
    startedAt: 'yesterday',
    duration: '26s',
    created: 0,
    updated: 0,
    failed: 14,
  },
  {
    id: 'RUN-9818',
    source: 'Engineering Docs',
    status: 'success',
    startedAt: '1 hour ago',
    duration: '3m 05s',
    created: 12,
    updated: 41,
    failed: 0,
  },
];

const sourceTypeColors: Record<DataSource['type'], string> = {
  GitHub: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  Jira: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
  Confluence: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400',
  SonarQube: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400',
  SharePoint: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400',
};

const artifactTypeColors: Record<Artifact['type'], string> = {
  Documentation: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
  Ticket: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400',
  Repository: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  'Pull Request': 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400',
  'Code Quality': 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400',
  Runbook: 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-400',
};

const getSourceStatusStyle = (status: SourceStatus) => {
  switch (status) {
    case 'connected':
      return 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400';
    case 'warning':
      return 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400';
    case 'failed':
      return 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400';
    case 'disabled':
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400';
  }
};

const getRunStatusStyle = (status: RunStatus) => {
  switch (status) {
    case 'success':
      return 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400';
    case 'partial':
      return 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400';
    case 'failed':
      return 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400';
    case 'running':
      return 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400';
  }
};

const getArtifactStatusStyle = (status: ArtifactStatus) => {
  switch (status) {
    case 'fresh':
      return 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400';
    case 'indexed':
      return 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400';
    case 'stale':
      return 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400';
    case 'failed':
      return 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400';
  }
};

const getSourceIcon = (type: DataSource['type']) => {
  switch (type) {
    case 'GitHub':
      return GitBranch;
    case 'Jira':
      return Activity;
    case 'Confluence':
      return FileText;
    case 'SonarQube':
      return ShieldAlert;
    case 'SharePoint':
      return Database;
  }
};

export default function DataIngestion() {
  const [activeTab, setActiveTab] = useState<'sources' | 'artifacts' | 'runs'>('sources');
  const [selectedSourceId, setSelectedSourceId] = useState<string>(mockSources[0].id);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedSource = mockSources.find((source) => source.id === selectedSourceId) || mockSources[0];
  const connectedSources = mockSources.filter((source) => source.status === 'connected').length;
  const totalArtifacts = mockSources.reduce((sum, source) => sum + source.artifacts, 0);
  const totalErrors = mockSources.reduce((sum, source) => sum + source.errors, 0);
  const staleArtifacts = mockArtifacts.filter((artifact) => artifact.status === 'stale').length;

  const filteredArtifacts = mockArtifacts.filter((artifact) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
        artifact.title.toLowerCase().includes(query) ||
        artifact.source.toLowerCase().includes(query) ||
        artifact.type.toLowerCase().includes(query) ||
        artifact.owner.toLowerCase().includes(query)
    );
  });

  return (
      <div className="size-full flex bg-background">
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-red-500" />
                Data Ingestion
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Manage connected sources, indexed artifacts, and ingestion runs
              </p>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-600 dark:text-gray-400">Connected Sources</span>
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{connectedSources}/{mockSources.length}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">available for the chatbot</p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-600 dark:text-gray-400">Indexed Artifacts</span>
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalArtifacts}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">docs, tickets, repos, reports</p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-600 dark:text-gray-400">Sync Errors</span>
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalErrors}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">needs review before next run</p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-600 dark:text-gray-400">Stale Artifacts</span>
                  <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{staleArtifacts}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">older than allowed threshold</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('sources')}
                        className={`px-1 transition-all relative ${
                            activeTab === 'sources'
                                ? 'text-gray-900 dark:text-white after:absolute after:-bottom-6 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                      Sources
                    </button>
                    <button
                        onClick={() => setActiveTab('artifacts')}
                        className={`px-1 transition-all relative ${
                            activeTab === 'artifacts'
                                ? 'text-gray-900 dark:text-white after:absolute after:-bottom-6 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                      Artifacts
                    </button>
                    <button
                        onClick={() => setActiveTab('runs')}
                        className={`px-1 transition-all relative ${
                            activeTab === 'runs'
                                ? 'text-gray-900 dark:text-white after:absolute after:-bottom-6 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                      Runs
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {activeTab === 'artifacts' && (
                        <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                          <Search size={18} className="text-gray-500 dark:text-gray-400" />
                          <input
                              value={searchQuery}
                              onChange={(event) => setSearchQuery(event.target.value)}
                              placeholder="Search artifacts..."
                              className="bg-transparent text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none w-48"
                          />
                        </div>
                    )}

                    {activeTab === 'sources' ? (
                        <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm hover:shadow-md">
                          <Plus size={20} />
                          Add Source
                        </button>
                    ) : activeTab === 'runs' ? (
                        <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm hover:shadow-md">
                          <Play size={18} />
                          Run Ingestion
                        </button>
                    ) : (
                        <button className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl transition-colors">
                          <Filter size={18} />
                          Filter
                        </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'sources' && (
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
                      <div className="space-y-4">
                        {mockSources.map((source) => {
                          const Icon = getSourceIcon(source.type);
                          const isSelected = selectedSourceId === source.id;

                          return (
                              <button
                                  key={source.id}
                                  onClick={() => setSelectedSourceId(source.id)}
                                  className={`w-full border rounded-lg p-6 text-left transition-all ${
                                      isSelected
                                          ? 'border-blue-500 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                                  }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex gap-4 flex-1">
                                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center flex-shrink-0">
                                      <Icon size={22} className="text-gray-700 dark:text-gray-300" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-2">
                                        <h3 className="text-gray-900 dark:text-white">{source.name}</h3>
                                        <span className={`px-3 py-1 rounded-full ${sourceTypeColors[source.type]}`}>
                                    {source.type}
                                  </span>
                                        <span className={`px-3 py-1 rounded-full ${getSourceStatusStyle(source.status)}`}>
                                    {source.status}
                                  </span>
                                      </div>
                                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                                        {source.description}
                                      </p>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Artifacts</div>
                                          <div className="text-gray-900 dark:text-white">{source.artifacts}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Last Sync</div>
                                          <div className="text-gray-900 dark:text-white">{source.lastSync}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Next Sync</div>
                                          <div className="text-gray-900 dark:text-white">{source.nextSync}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Errors</div>
                                          <div className={source.errors > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}>
                                            {source.errors}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRight size={24} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                </div>
                              </button>
                          );
                        })}
                      </div>

                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden h-fit">
                        <div className="px-6 py-5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h3 className="text-gray-900 dark:text-white">Source Details</h3>
                              <p className="text-gray-600 dark:text-gray-400">{selectedSource.name}</p>
                            </div>
                            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                              <Settings size={18} className="text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        </div>

                        <div className="p-6 space-y-6">
                          <div>
                            <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Configured Scope</label>
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                              {selectedSource.scope}
                            </div>
                          </div>

                          <div>
                            <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Ingestion Pipeline</label>
                            <div className="space-y-2">
                              {['Fetch source data', 'Extract content', 'Chunk & enrich metadata', 'Index for chatbot'].map((step, index) => (
                                  <div key={step} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                                      {index + 1}
                                    </div>
                                    <span className="text-gray-900 dark:text-white">{step}</span>
                                  </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Allowed Content</label>
                            <div className="flex gap-2 flex-wrap">
                              {['README', 'Docs', 'Tickets', 'PRs', 'Comments', 'Reports'].map((item) => (
                                  <span key={item} className="px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
                              {item}
                            </span>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm">
                              <RefreshCw size={18} />
                              Run Sync
                            </button>
                            <button className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white rounded-xl transition-colors">
                              <ExternalLink size={18} />
                              Open Source
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                )}

                {activeTab === 'artifacts' && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_110px_80px] gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <div className="text-gray-600 dark:text-gray-400 uppercase tracking-wide">Artifact</div>
                        <div className="text-gray-600 dark:text-gray-400 uppercase tracking-wide">Source</div>
                        <div className="text-gray-600 dark:text-gray-400 uppercase tracking-wide">Owner</div>
                        <div className="text-gray-600 dark:text-gray-400 uppercase tracking-wide">Updated</div>
                        <div className="text-gray-600 dark:text-gray-400 uppercase tracking-wide">Chunks</div>
                        <div className="text-gray-600 dark:text-gray-400 text-right uppercase tracking-wide">Open</div>
                      </div>

                      {filteredArtifacts.map((artifact) => (
                          <div
                              key={artifact.id}
                              className="grid grid-cols-[1.8fr_1fr_1fr_1fr_110px_80px] gap-4 px-6 py-5 border-b border-gray-200 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex flex-col justify-center gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-gray-900 dark:text-white">{artifact.title}</span>
                                <span className={`px-3 py-1 rounded-full ${artifactTypeColors[artifact.type]}`}>{artifact.type}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full ${getArtifactStatusStyle(artifact.status)}`}>{artifact.status}</span>
                                <span className="text-gray-500 dark:text-gray-400">{artifact.id}</span>
                              </div>
                            </div>
                            <div className="flex items-center text-gray-900 dark:text-white">{artifact.source}</div>
                            <div className="flex items-center text-gray-900 dark:text-white">{artifact.owner}</div>
                            <div className="flex items-center text-gray-600 dark:text-gray-400">{artifact.lastUpdated}</div>
                            <div className="flex items-center text-gray-900 dark:text-white">{artifact.chunks}</div>
                            <div className="flex items-center justify-end">
                              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <ChevronRight size={20} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                              </button>
                            </div>
                          </div>
                      ))}
                    </div>
                )}

                {activeTab === 'runs' && (
                    <div className="space-y-4">
                      {mockRuns.map((run) => (
                          <div
                              key={run.id}
                              className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                          >
                            <div className="flex items-start justify-between gap-4 mb-5">
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-gray-900 dark:text-white">{run.id}</h3>
                                  <span className={`px-3 py-1 rounded-full ${getRunStatusStyle(run.status)}`}>{run.status}</span>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400">{run.source}</p>
                              </div>
                              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <ChevronRight size={24} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Started</div>
                                <div className="text-gray-900 dark:text-white">{run.startedAt}</div>
                              </div>
                              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Duration</div>
                                <div className="text-gray-900 dark:text-white">{run.duration}</div>
                              </div>
                              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Created</div>
                                <div className="text-gray-900 dark:text-white">{run.created}</div>
                              </div>
                              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Updated</div>
                                <div className="text-gray-900 dark:text-white">{run.updated}</div>
                              </div>
                              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Failed</div>
                                <div className={run.failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}>{run.failed}</div>
                              </div>
                            </div>

                            {run.status === 'failed' || run.status === 'partial' ? (
                                <div className="mt-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900">
                                  <AlertTriangle size={20} className="text-yellow-700 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <div className="text-yellow-800 dark:text-yellow-300">Some artifacts could not be ingested.</div>
                                    <p className="text-yellow-700 dark:text-yellow-400 mt-1">
                                      Check source permissions, rate limits, and unsupported file formats before retrying.
                                    </p>
                                  </div>
                                </div>
                            ) : null}
                          </div>
                      ))}
                    </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}