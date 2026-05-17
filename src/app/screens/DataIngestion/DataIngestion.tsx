import { motion } from 'motion/react';
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
  X,
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

interface ProjectIngestionData {
  id: string;
  name: string;
  description: string;
  sources: DataSource[];
  artifacts: Artifact[];
  runs: IngestionRun[];
}

const mockProjects: ProjectIngestionData[] = [
  {
    id: 'sprintstart',
    name: 'Project Alpha',
    description: 'Internal onboarding and project knowledge platform.',
    sources: [
      {
        id: 'sprintstart-github',
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
        id: 'sprintstart-jira',
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
        id: 'sprintstart-docs',
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
        id: 'sprintstart-sonar',
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
    ],
    artifacts: [
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
    ],
    runs: [
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
    ],
  },
  {
    id: 'customer-portal',
    name: 'Project Beta',
    description: 'Customer-facing portal for accounts, invoices, and support workflows.',
    sources: [
      {
        id: 'portal-github',
        name: 'Customer Portal Repository',
        type: 'GitHub',
        status: 'connected',
        scope: 'org/customer-portal, org/design-system',
        artifacts: 289,
        lastSync: '8 minutes ago',
        nextSync: 'in 52 minutes',
        errors: 0,
        description: 'Indexes portal application source code, pull requests, READMEs, and package metadata.',
      },
      {
        id: 'portal-jira',
        name: 'Portal Jira Board',
        type: 'Jira',
        status: 'connected',
        scope: 'PORTAL, UX, BUG tickets',
        artifacts: 174,
        lastSync: '22 minutes ago',
        nextSync: 'in 38 minutes',
        errors: 0,
        description: 'Indexes user stories, defects, acceptance criteria, sprint metadata, and comments.',
      },
      {
        id: 'portal-sharepoint',
        name: 'Product SharePoint Docs',
        type: 'SharePoint',
        status: 'warning',
        scope: 'Customer Portal / Product / Support',
        artifacts: 96,
        lastSync: '2 hours ago',
        nextSync: 'in 1 hour',
        errors: 3,
        description: 'Indexes product documents, support playbooks, customer FAQs, and release notes.',
      },
    ],
    artifacts: [
      {
        id: 'CP-201',
        title: 'Portal Local Setup',
        source: 'Customer Portal Repository',
        type: 'Documentation',
        owner: 'Portal Team',
        lastUpdated: '1 day ago',
        status: 'fresh',
        chunks: 15,
      },
      {
        id: 'CP-202',
        title: 'Invoice Download Flow',
        source: 'Portal Jira Board',
        type: 'Ticket',
        owner: 'Nina Bauer',
        lastUpdated: '4 days ago',
        status: 'indexed',
        chunks: 8,
      },
      {
        id: 'CP-203',
        title: 'Customer Portal repository',
        source: 'Customer Portal Repository',
        type: 'Repository',
        owner: 'Frontend Team',
        lastUpdated: '8 minutes ago',
        status: 'fresh',
        chunks: 102,
      },
      {
        id: 'CP-204',
        title: 'Support Escalation Runbook',
        source: 'Product SharePoint Docs',
        type: 'Runbook',
        owner: 'Support Ops',
        lastUpdated: '7 months ago',
        status: 'stale',
        chunks: 19,
      },
    ],
    runs: [
      {
        id: 'RUN-7712',
        source: 'Customer Portal Repository',
        status: 'success',
        startedAt: '8 minutes ago',
        duration: '1m 05s',
        created: 3,
        updated: 21,
        failed: 0,
      },
      {
        id: 'RUN-7711',
        source: 'Portal Jira Board',
        status: 'success',
        startedAt: '22 minutes ago',
        duration: '1m 49s',
        created: 2,
        updated: 13,
        failed: 0,
      },
      {
        id: 'RUN-7710',
        source: 'Product SharePoint Docs',
        status: 'partial',
        startedAt: '2 hours ago',
        duration: '2m 36s',
        created: 1,
        updated: 9,
        failed: 3,
      },
    ],
  },
  {
    id: 'legacy-modernization',
    name: 'Project Gamma',
    description: 'Migration project for legacy services, APIs, and infrastructure documentation.',
    sources: [
      {
        id: 'legacy-github',
        name: 'Legacy Migration Repository',
        type: 'GitHub',
        status: 'warning',
        scope: 'org/legacy-migration, org/api-adapters',
        artifacts: 211,
        lastSync: '45 minutes ago',
        nextSync: 'in 15 minutes',
        errors: 5,
        description: 'Indexes migration scripts, adapter services, README files, and open pull requests.',
      },
      {
        id: 'legacy-docs',
        name: 'Architecture Wiki',
        type: 'Confluence',
        status: 'connected',
        scope: 'Legacy Architecture, Migration ADRs, Runbooks',
        artifacts: 158,
        lastSync: '25 minutes ago',
        nextSync: 'in 35 minutes',
        errors: 0,
        description: 'Indexes architecture pages, migration decisions, runbooks, and dependency mappings.',
      },
      {
        id: 'legacy-sonar',
        name: 'Legacy SonarQube Projects',
        type: 'SonarQube',
        status: 'connected',
        scope: 'legacy-api, migration-worker, adapter-service',
        artifacts: 73,
        lastSync: '1 hour ago',
        nextSync: 'in 3 hours',
        errors: 0,
        description: 'Indexes technical debt, vulnerabilities, coverage metrics, and quality gates.',
      },
    ],
    artifacts: [
      {
        id: 'LM-301',
        title: 'Migration Strategy Overview',
        source: 'Architecture Wiki',
        type: 'Documentation',
        owner: 'Architecture Team',
        lastUpdated: '3 days ago',
        status: 'fresh',
        chunks: 24,
      },
      {
        id: 'LM-302',
        title: 'Adapter Service Repository',
        source: 'Legacy Migration Repository',
        type: 'Repository',
        owner: 'Migration Team',
        lastUpdated: '45 minutes ago',
        status: 'indexed',
        chunks: 88,
      },
      {
        id: 'LM-303',
        title: 'Legacy API Quality Gate',
        source: 'Legacy SonarQube Projects',
        type: 'Code Quality',
        owner: 'QA Team',
        lastUpdated: '1 hour ago',
        status: 'fresh',
        chunks: 11,
      },
      {
        id: 'LM-304',
        title: 'Rollback Runbook',
        source: 'Architecture Wiki',
        type: 'Runbook',
        owner: 'DevOps Team',
        lastUpdated: '1 year ago',
        status: 'stale',
        chunks: 17,
      },
    ],
    runs: [
      {
        id: 'RUN-5531',
        source: 'Legacy Migration Repository',
        status: 'partial',
        startedAt: '45 minutes ago',
        duration: '2m 11s',
        created: 4,
        updated: 18,
        failed: 5,
      },
      {
        id: 'RUN-5530',
        source: 'Architecture Wiki',
        status: 'success',
        startedAt: '25 minutes ago',
        duration: '2m 58s',
        created: 6,
        updated: 29,
        failed: 0,
      },
      {
        id: 'RUN-5529',
        source: 'Legacy SonarQube Projects',
        status: 'success',
        startedAt: '1 hour ago',
        duration: '44s',
        created: 1,
        updated: 8,
        failed: 0,
      },
    ],
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
  const [selectedProjectId, setSelectedProjectId] = useState<string>(mockProjects[0].id);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedProject = mockProjects.find((project) => project.id === selectedProjectId) || mockProjects[0];
  const mockSources = selectedProject.sources;
  const mockArtifacts = selectedProject.artifacts;
  const mockRuns = selectedProject.runs;

  const selectedSource = selectedSourceId
      ? mockSources.find((source) => source.id === selectedSourceId) || null
      : null;

  const connectedSources = mockSources.filter((source) => source.status === 'connected').length;
  const totalArtifacts = mockSources.reduce((sum, source) => sum + source.artifacts, 0);
  const totalErrors = mockSources.reduce((sum, source) => sum + source.errors, 0);
  const staleArtifacts = mockArtifacts.filter((artifact) => artifact.status === 'stale').length;

  const handleProjectChange = (projectId: string) => {
    const nextProject = mockProjects.find((project) => project.id === projectId) || mockProjects[0];

    setSelectedProjectId(nextProject.id);
    setSelectedSourceId(null);
    setSearchQuery('');
    setActiveTab('sources');
  };

  const handleTabChange = (tab: 'sources' | 'artifacts' | 'runs') => {
    setActiveTab(tab);

    if (tab !== 'sources') {
      setSelectedSourceId(null);
    }
  };

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
      <div className="relative size-full min-h-screen flex bg-gray-50 dark:bg-gray-950 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <header className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-red-500 shrink-0" />
                  Data Ingestion
                </h1>

                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  Manage connected sources, indexed artifacts, and ingestion runs
                </p>
              </div>

              <select
                  value={selectedProjectId}
                  onChange={(event) => handleProjectChange(event.target.value)}
                  className="w-full lg:w-64 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                {mockProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                ))}
              </select>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                    Connected Sources
                  </span>
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {connectedSources}/{mockSources.length}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    available for the chatbot
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                    Indexed Artifacts
                  </span>
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {totalArtifacts}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    docs, tickets, repos, reports
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                    Sync Errors
                  </span>
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {totalErrors}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    needs review before next run
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                    Stale Artifacts
                  </span>
                    <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {staleArtifacts}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    older than allowed threshold
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-4 sm:px-6 sm:py-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex gap-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-x-auto w-full xl:w-auto">
                      <button
                          onClick={() => handleTabChange('sources')}
                          className={`shrink-0 box-border px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                              activeTab === 'sources'
                                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border-gray-200 dark:border-gray-600'
                                  : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                      >
                        Sources
                      </button>

                      <button
                          onClick={() => handleTabChange('artifacts')}
                          className={`shrink-0 box-border px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                              activeTab === 'artifacts'
                                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border-gray-200 dark:border-gray-600'
                                  : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                      >
                        Artifacts
                      </button>

                      <button
                          onClick={() => handleTabChange('runs')}
                          className={`shrink-0 box-border px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                              activeTab === 'runs'
                                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border-gray-200 dark:border-gray-600'
                                  : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                      >
                        Runs
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto sm:items-center">
                      {activeTab === 'artifacts' && (
                          <div className="relative w-full sm:w-72 h-11">
                            <Search
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                            />
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search artifacts..."
                                className="h-11 w-full pl-10 pr-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                      )}

                      {activeTab === 'sources' ? (
                          <button className="h-11 w-full sm:w-auto flex items-center justify-center gap-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm hover:shadow-md text-sm font-bold">
                            <Plus size={18} />
                            Add Source
                          </button>
                      ) : activeTab === 'runs' ? (
                          <button className="h-11 w-full sm:w-auto flex items-center justify-center gap-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm hover:shadow-md text-sm font-bold">
                            <Play size={18} />
                            Run Ingestion
                          </button>
                      ) : (
                          <button className="h-11 w-full sm:w-auto flex items-center justify-center gap-2 px-5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl transition-colors text-sm font-bold">
                            <Filter size={18} />
                            Filter
                          </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {activeTab === 'sources' && (
                      <div className="space-y-4">
                        {mockSources.map((source) => {
                          const Icon = getSourceIcon(source.type);
                          const isSelected = selectedSource?.id === source.id;

                          return (
                              <button
                                  key={source.id}
                                  onClick={() => setSelectedSourceId(source.id)}
                                  className={`w-full border rounded-2xl p-4 sm:p-6 text-left transition-all ${
                                      isSelected
                                          ? 'border-blue-500 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                                  }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex flex-col sm:flex-row gap-4 flex-1 min-w-0">
                                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
                                      <Icon size={22} className="text-gray-700 dark:text-gray-300" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-2">
                                        <h3 className="text-gray-900 dark:text-white font-bold break-words">
                                          {source.name}
                                        </h3>

                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${sourceTypeColors[source.type]}`}
                                        >
                                    {source.type}
                                  </span>

                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${getSourceStatusStyle(source.status)}`}
                                        >
                                    {source.status}
                                  </span>
                                      </div>

                                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                                        {source.description}
                                      </p>

                                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                        <div>
                                          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                            Artifacts
                                          </div>
                                          <div className="text-gray-900 dark:text-white">{source.artifacts}</div>
                                        </div>

                                        <div>
                                          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                            Last Sync
                                          </div>
                                          <div className="text-gray-900 dark:text-white">{source.lastSync}</div>
                                        </div>

                                        <div>
                                          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                            Next Sync
                                          </div>
                                          <div className="text-gray-900 dark:text-white">{source.nextSync}</div>
                                        </div>

                                        <div>
                                          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                            Errors
                                          </div>
                                          <div
                                              className={
                                                source.errors > 0
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-gray-900 dark:text-white'
                                              }
                                          >
                                            {source.errors}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <ChevronRight
                                      size={22}
                                      className="text-gray-500 dark:text-gray-400 shrink-0 mt-1"
                                  />
                                </div>
                              </button>
                          );
                        })}
                      </div>
                  )}

                  {activeTab === 'artifacts' && (
                      <>
                        <div className="hidden lg:block border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                          <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_110px_80px] gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                              Artifact
                            </div>
                            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                              Source
                            </div>
                            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                              Owner
                            </div>
                            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                              Updated
                            </div>
                            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                              Chunks
                            </div>
                            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 text-right uppercase tracking-wide">
                              Open
                            </div>
                          </div>

                          {filteredArtifacts.map((artifact) => (
                              <div
                                  key={artifact.id}
                                  className="grid grid-cols-[1.8fr_1fr_1fr_1fr_110px_80px] gap-4 px-6 py-5 border-b border-gray-200 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                <div className="flex flex-col justify-center gap-2 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-gray-900 dark:text-white truncate">
                                {artifact.title}
                              </span>
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-bold ${artifactTypeColors[artifact.type]}`}
                                    >
                                {artifact.type}
                              </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                              <span
                                  className={`px-3 py-1 rounded-full text-xs font-bold ${getArtifactStatusStyle(artifact.status)}`}
                              >
                                {artifact.status}
                              </span>
                                    <span className="text-gray-500 dark:text-gray-400">{artifact.id}</span>
                                  </div>
                                </div>

                                <div className="flex items-center text-gray-900 dark:text-white min-w-0">
                                  <span className="truncate">{artifact.source}</span>
                                </div>

                                <div className="flex items-center text-gray-900 dark:text-white min-w-0">
                                  <span className="truncate">{artifact.owner}</span>
                                </div>

                                <div className="flex items-center text-gray-600 dark:text-gray-400">
                                  {artifact.lastUpdated}
                                </div>

                                <div className="flex items-center text-gray-900 dark:text-white">
                                  {artifact.chunks}
                                </div>

                                <div className="flex items-center justify-end">
                                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                    <ChevronRight
                                        size={20}
                                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                    />
                                  </button>
                                </div>
                              </div>
                          ))}
                        </div>

                        <div className="lg:hidden space-y-3">
                          {filteredArtifacts.map((artifact) => (
                              <div
                                  key={artifact.id}
                                  className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-gray-900 dark:text-white font-bold break-words">
                                      {artifact.title}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      {artifact.id}
                                    </div>
                                  </div>

                                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0">
                                    <ChevronRight size={20} className="text-gray-500 dark:text-gray-400" />
                                  </button>
                                </div>

                                <div className="flex gap-2 flex-wrap mt-3">
                            <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${artifactTypeColors[artifact.type]}`}
                            >
                              {artifact.type}
                            </span>
                                  <span
                                      className={`px-3 py-1 rounded-full text-xs font-bold ${getArtifactStatusStyle(artifact.status)}`}
                                  >
                              {artifact.status}
                            </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-4">
                                  <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                                      Source
                                    </div>
                                    <div className="text-sm text-gray-900 dark:text-white break-words">
                                      {artifact.source}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                                      Owner
                                    </div>
                                    <div className="text-sm text-gray-900 dark:text-white break-words">
                                      {artifact.owner}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                                      Updated
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      {artifact.lastUpdated}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                                      Chunks
                                    </div>
                                    <div className="text-sm text-gray-900 dark:text-white">
                                      {artifact.chunks}
                                    </div>
                                  </div>
                                </div>
                              </div>
                          ))}
                        </div>
                      </>
                  )}

                  {activeTab === 'runs' && (
                      <div className="space-y-4">
                        {mockRuns.map((run) => (
                            <div
                                key={run.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                            >
                              <div className="flex items-start justify-between gap-4 mb-5">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                                    <h3 className="text-gray-900 dark:text-white font-bold">{run.id}</h3>
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-bold ${getRunStatusStyle(run.status)}`}
                                    >
                                {run.status}
                              </span>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                                    {run.source}
                                  </p>
                                </div>

                                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0">
                                  <ChevronRight
                                      size={22}
                                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                  />
                                </button>
                              </div>

                              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Started
                                  </div>
                                  <div className="text-gray-900 dark:text-white">{run.startedAt}</div>
                                </div>

                                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Duration
                                  </div>
                                  <div className="text-gray-900 dark:text-white">{run.duration}</div>
                                </div>

                                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Created
                                  </div>
                                  <div className="text-gray-900 dark:text-white">{run.created}</div>
                                </div>

                                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Updated
                                  </div>
                                  <div className="text-gray-900 dark:text-white">{run.updated}</div>
                                </div>

                                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Failed
                                  </div>
                                  <div
                                      className={
                                        run.failed > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-gray-900 dark:text-white'
                                      }
                                  >
                                    {run.failed}
                                  </div>
                                </div>
                              </div>

                              {(run.status === 'failed' || run.status === 'partial') && (
                                  <div className="mt-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900">
                                    <AlertTriangle
                                        size={20}
                                        className="text-yellow-700 dark:text-yellow-400 shrink-0 mt-0.5"
                                    />
                                    <div>
                                      <div className="text-yellow-800 dark:text-yellow-300 font-bold">
                                        Some artifacts could not be ingested.
                                      </div>
                                      <p className="text-yellow-700 dark:text-yellow-400 mt-1 leading-relaxed">
                                        Check source permissions, rate limits, and unsupported file formats before retrying.
                                      </p>
                                    </div>
                                  </div>
                              )}
                            </div>
                        ))}
                      </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>

        {selectedSource && (
            <>
              <button
                  type="button"
                  aria-label="Close source details"
                  onClick={() => setSelectedSourceId(null)}
                  className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] lg:hidden"
              />

              <motion.aside
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-y-0 right-0 z-40 flex h-screen w-[min(92vw,26rem)] max-w-full flex-col border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl lg:static lg:z-auto lg:h-auto lg:w-[26rem] lg:shrink-0 lg:shadow-xl"
              >
                <div className="px-4 py-4 sm:px-6 sm:py-5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-gray-900 dark:text-white font-bold">Source Details</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {selectedSource.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <Settings size={18} className="text-gray-500 dark:text-gray-400" />
                      </button>

                      <button
                          onClick={() => setSelectedSourceId(null)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <X
                            size={18}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5 sm:space-y-6 text-sm">
                  <div className="flex gap-2 flex-wrap">
                <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${sourceTypeColors[selectedSource.type]}`}
                >
                  {selectedSource.type}
                </span>

                    <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${getSourceStatusStyle(selectedSource.status)}`}
                    >
                  {selectedSource.status}
                </span>

                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {selectedSource.artifacts} artifacts
                </span>
                  </div>

                  <div>
                    <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Configured Scope
                    </label>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white leading-relaxed break-words">
                      {selectedSource.scope}
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Description
                    </label>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white leading-relaxed break-words">
                      {selectedSource.description}
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Ingestion Pipeline
                    </label>

                    <div className="space-y-2">
                      {['Fetch source data', 'Extract content', 'Chunk & enrich metadata', 'Index for chatbot'].map(
                          (step, index) => (
                              <div
                                  key={step}
                                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                              >
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 text-xs font-bold">
                                  {index + 1}
                                </div>
                                <span className="text-gray-900 dark:text-white break-words">{step}</span>
                              </div>
                          ),
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Allowed Content
                    </label>

                    <div className="flex gap-2 flex-wrap">
                      {['README', 'Docs', 'Tickets', 'PRs', 'Comments', 'Reports'].map((item) => (
                          <span
                              key={item}
                              className="px-4 py-1.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                          >
                      {item}
                    </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Last Sync
                      </div>
                      <div className="text-gray-900 dark:text-white">{selectedSource.lastSync}</div>
                    </div>

                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Next Sync
                      </div>
                      <div className="text-gray-900 dark:text-white">{selectedSource.nextSync}</div>
                    </div>

                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Artifacts
                      </div>
                      <div className="text-gray-900 dark:text-white">{selectedSource.artifacts}</div>
                    </div>

                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Errors
                      </div>
                      <div
                          className={
                            selectedSource.errors > 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-900 dark:text-white'
                          }
                      >
                        {selectedSource.errors}
                      </div>
                    </div>
                  </div>

                  {selectedSource.errors > 0 && (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900">
                        <AlertTriangle
                            size={20}
                            className="text-yellow-700 dark:text-yellow-400 shrink-0 mt-0.5"
                        />
                        <div>
                          <div className="text-yellow-800 dark:text-yellow-300 font-bold">
                            Review recommended
                          </div>
                          <p className="text-yellow-700 dark:text-yellow-400 mt-1 leading-relaxed">
                            Check source permissions, expired tokens, rate limits, or unsupported files before retrying.
                          </p>
                        </div>
                      </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm font-bold">
                      <RefreshCw size={18} />
                      Run Sync
                    </button>

                    <button className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white rounded-xl transition-colors font-bold">
                      <ExternalLink size={18} />
                      Open Source
                    </button>
                  </div>
                </div>
              </motion.aside>
            </>
        )}
      </div>
  );
}