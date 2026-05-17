import { motion } from 'motion/react';
import {
  AlertTriangle,
  Database,
  Download,
  ExternalLink,
  FileDown,
  Filter,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

interface AuditEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'security';
  service: 'INGESTION' | 'CONFIG' | 'EXPORT' | 'ACCESS' | 'SECURITY' | 'SYSTEM';
  action: string;
  actor: string;
  role: string;
  source: string;
  target: string;
  result: 'Completed' | 'Allowed' | 'Blocked' | 'Failed';
  ipAddress: string;
  message: string;
  details: string;
  fields: string[];
}

interface ProjectLogs {
  id: string;
  name: string;
  logs: AuditEntry[];
}

const PROJECT_LOGS: ProjectLogs[] = [
  {
    id: 'project-alpha',
    name: 'Project Alpha',
    logs: [
      {
        id: 'ALPHA-10492',
        timestamp: '2026-05-10 14:21:08',
        level: 'info',
        service: 'INGESTION',
        action: 'Manual ingestion run started',
        actor: 'Max Mustermann',
        role: 'Admin',
        source: 'GitHub',
        target: 'Frontend GitHub Repository',
        result: 'Completed',
        ipAddress: '192.168.178.24',
        message: 'GitHub source synced successfully. 8 artifacts created, 34 updated, 0 failed.',
        details: 'The repository scope was fetched, content was extracted, metadata was enriched and the artifacts were indexed for chatbot retrieval.',
        fields: ['createdArtifacts', 'updatedArtifacts', 'lastSync', 'indexVersion'],
      },
      {
        id: 'ALPHA-10491',
        timestamp: '2026-05-10 14:08:42',
        level: 'info',
        service: 'EXPORT',
        action: 'Ingestion report exported',
        actor: 'Anna Schmidt',
        role: 'Project Manager',
        source: 'All Sources',
        target: 'Monthly Source Quality Report',
        result: 'Completed',
        ipAddress: '192.168.178.31',
        message: 'CSV export generated for source quality metrics from 2026-04-01 to 2026-05-10.',
        details: 'The export contains source status, artifact counts, sync errors, stale artifacts and failed ingestion runs.',
        fields: ['reportType', 'dateRange', 'exportFormat'],
      },
      {
        id: 'ALPHA-10490',
        timestamp: '2026-05-10 13:55:17',
        level: 'warn',
        service: 'CONFIG',
        action: 'Source scope changed',
        actor: 'Max Mustermann',
        role: 'Admin',
        source: 'Jira',
        target: 'Jira Project Board',
        result: 'Allowed',
        ipAddress: '192.168.178.24',
        message: 'Scope changed from SPRINT tickets to SPRINT, ONB and FE tickets.',
        details: 'This affects which Jira issues, comments and sprint metadata become available to the chatbot and onboarding path generator.',
        fields: ['allowedProjects', 'issueTypes', 'commentsIncluded'],
      },
      {
        id: 'ALPHA-10489',
        timestamp: '2026-05-10 13:49:03',
        level: 'error',
        service: 'INGESTION',
        action: 'Scheduled ingestion failed',
        actor: 'System',
        role: 'Service Account',
        source: 'SonarQube',
        target: 'SonarQube Quality Reports',
        result: 'Failed',
        ipAddress: 'system',
        message: 'Access token expired. Quality reports could not be indexed for the current run.',
        details: 'Quality gates, code smells, vulnerabilities and coverage metrics are currently stale until the token is renewed.',
        fields: ['tokenStatus', 'failedArtifacts', 'lastError'],
      },
      {
        id: 'ALPHA-10488',
        timestamp: '2026-05-10 13:41:29',
        level: 'security',
        service: 'SECURITY',
        action: 'Restricted artifact access blocked',
        actor: 'Tom Weber',
        role: 'Member',
        source: 'Confluence',
        target: 'Security Incident Runbook',
        result: 'Blocked',
        ipAddress: '192.168.178.44',
        message: 'User attempted to open an artifact outside of assigned project scope.',
        details: 'The request was blocked because the artifact requires Security Team or Admin access. No data was exposed to the user.',
        fields: ['artifactId', 'requiredRole', 'userRole', 'projectScope'],
      },
    ],
  },
  {
    id: 'project-beta',
    name: 'Project Beta',
    logs: [
      {
        id: 'BETA-8821',
        timestamp: '2026-05-10 15:04:33',
        level: 'info',
        service: 'INGESTION',
        action: 'Scheduled sync completed',
        actor: 'System',
        role: 'Service Account',
        source: 'SharePoint',
        target: 'Product SharePoint Docs',
        result: 'Completed',
        ipAddress: 'system',
        message: 'Product documentation synced. 5 artifacts created, 18 updated, 0 failed.',
        details: 'Product docs, support playbooks, customer FAQs and release notes were refreshed and indexed.',
        fields: ['createdArtifacts', 'updatedArtifacts', 'lastSync'],
      },
      {
        id: 'BETA-8820',
        timestamp: '2026-05-10 14:52:19',
        level: 'warn',
        service: 'ACCESS',
        action: 'High request volume detected',
        actor: 'System',
        role: 'Service Account',
        source: 'Gateway',
        target: 'Customer Portal Chat Endpoint',
        result: 'Allowed',
        ipAddress: 'system',
        message: 'Request volume exceeded usual baseline but remained below rate limit threshold.',
        details: 'The system observed increased chatbot traffic for customer portal onboarding questions.',
        fields: ['requestRate', 'baseline', 'threshold'],
      },
      {
        id: 'BETA-8819',
        timestamp: '2026-05-10 14:39:07',
        level: 'info',
        service: 'CONFIG',
        action: 'Artifact freshness threshold updated',
        actor: 'Nina Bauer',
        role: 'Project Manager',
        source: 'System',
        target: 'Customer Portal Knowledge Settings',
        result: 'Allowed',
        ipAddress: '192.168.178.51',
        message: 'Stale artifact threshold changed from 180 days to 120 days.',
        details: 'Artifacts older than 120 days are now highlighted in dashboards and onboarding recommendations.',
        fields: ['freshnessThreshold', 'knowledgeQualityRules'],
      },
      {
        id: 'BETA-8818',
        timestamp: '2026-05-10 14:12:44',
        level: 'security',
        service: 'SECURITY',
        action: 'Export permission denied',
        actor: 'Chris Klein',
        role: 'Member',
        source: 'All Sources',
        target: 'Customer Portal Report Export',
        result: 'Blocked',
        ipAddress: '192.168.178.62',
        message: 'User attempted to export a report without sufficient permissions.',
        details: 'Only Admin and Project Manager roles may export cross-source reports for this project.',
        fields: ['requiredRole', 'userRole', 'exportType'],
      },
    ],
  },
  {
    id: 'project-gamma',
    name: 'Project Gamma',
    logs: [
      {
        id: 'GAMMA-5514',
        timestamp: '2026-05-10 16:18:02',
        level: 'error',
        service: 'INGESTION',
        action: 'Repository sync partially failed',
        actor: 'System',
        role: 'Service Account',
        source: 'GitHub',
        target: 'Legacy Migration Repository',
        result: 'Failed',
        ipAddress: 'system',
        message: 'Could not read 5 archived branches because repository permissions changed.',
        details: 'The latest ingestion run indexed the default branch, but archived branches were skipped due to missing read permissions.',
        fields: ['branchPermissions', 'failedBranches', 'lastError'],
      },
      {
        id: 'GAMMA-5513',
        timestamp: '2026-05-10 16:02:27',
        level: 'warn',
        service: 'CONFIG',
        action: 'Legacy source marked as high risk',
        actor: 'Lea Hoffmann',
        role: 'Admin',
        source: 'Confluence',
        target: 'Legacy Architecture Wiki',
        result: 'Allowed',
        ipAddress: '192.168.178.77',
        message: 'Critical architecture pages are older than the configured freshness threshold.',
        details: 'Several migration ADRs and rollback runbooks require review before they should be used as onboarding references.',
        fields: ['riskLevel', 'staleArtifacts', 'owner'],
      },
      {
        id: 'GAMMA-5512',
        timestamp: '2026-05-10 15:44:16',
        level: 'info',
        service: 'EXPORT',
        action: 'Knowledge risk report exported',
        actor: 'Lea Hoffmann',
        role: 'Admin',
        source: 'All Sources',
        target: 'Legacy Modernization Risk Report',
        result: 'Completed',
        ipAddress: '192.168.178.77',
        message: 'PDF export generated for stale artifacts and missing owners.',
        details: 'The report includes stale runbooks, missing ADR owners, failed syncs and migration-specific knowledge gaps.',
        fields: ['reportType', 'exportFormat', 'includedSections'],
      },
      {
        id: 'GAMMA-5511',
        timestamp: '2026-05-10 15:21:38',
        level: 'info',
        service: 'SYSTEM',
        action: 'Vector index compacted',
        actor: 'System',
        role: 'Service Account',
        source: 'System',
        target: 'Legacy Modernization Vector Index',
        result: 'Completed',
        ipAddress: 'system',
        message: 'Index compaction finished successfully. Search latency reduced by 18%.',
        details: 'The maintenance job compacted obsolete chunks and rebuilt metadata references for migration artifacts.',
        fields: ['indexSize', 'latency', 'removedChunks'],
      },
    ],
  },
];

const LEVEL_COLORS: Record<AuditEntry['level'], string> = {
  info: 'text-blue-500',
  warn: 'text-amber-500',
  error: 'text-red-500',
  security: 'text-purple-500',
};

const LEVEL_BADGES: Record<AuditEntry['level'], string> = {
  info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  warn: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  error: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  security: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
};

const SERVICE_BADGES: Record<AuditEntry['service'], string> = {
  INGESTION: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
  CONFIG: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400',
  EXPORT: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400',
  ACCESS: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  SECURITY: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400',
  SYSTEM: 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400',
};

export default function SystemLogs() {
  const [selectedProjectId, setSelectedProjectId] = useState(PROJECT_LOGS[0].id);
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'security'>('all');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);

  const selectedProject = PROJECT_LOGS.find((project) => project.id === selectedProjectId) || PROJECT_LOGS[0];
  const projectLogs = selectedProject.logs;

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedLog(null);
    setSearch('');
  };

  const filteredLogs = useMemo(() => {
    const query = search.toLowerCase().trim();

    return projectLogs.filter((log) => {
      const matchesLevel = filter === 'all' || log.level === filter;
      const matchesSearch =
          !query ||
          log.id.toLowerCase().includes(query) ||
          log.actor.toLowerCase().includes(query) ||
          log.service.toLowerCase().includes(query) ||
          log.source.toLowerCase().includes(query) ||
          log.target.toLowerCase().includes(query) ||
          log.message.toLowerCase().includes(query) ||
          log.ipAddress.toLowerCase().includes(query);

      return matchesLevel && matchesSearch;
    });
  }, [filter, search, projectLogs]);

  const errors24h = projectLogs.filter((log) => log.level === 'error').length;
  const warnings24h = projectLogs.filter((log) => log.level === 'warn').length;
  const securityEvents = projectLogs.filter((log) => log.level === 'security').length;
  const exports24h = projectLogs.filter((log) => log.service === 'EXPORT').length;

  return (
      <div className="size-full flex bg-background">
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
          <header className="px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
            <div className="flex items-center justify-between gap-6">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  System Log
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Trace user actions, source changes, exports, and security-relevant events
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                    value={selectedProjectId}
                    onChange={(event) => handleProjectChange(event.target.value)}
                    className="min-w-52 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  {PROJECT_LOGS.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                  ))}
                </select>

                <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 transition-all hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Trash2 className="w-4 h-4" />
                  Clear View
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold transition-all hover:bg-blue-700 shadow-md">
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-8">
            <div className="max-w-7xl mx-auto w-full space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">0{errors24h}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Errors</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">0{warnings24h}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Warnings</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">0{securityEvents}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Security</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl flex items-center justify-center">
                    <FileDown className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">0{exports24h}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Exports</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-x-auto w-full md:w-auto">
                  {['all', 'info', 'warn', 'error', 'security'].map((level) => (
                      <button
                          key={level}
                          onClick={() => setFilter(level as 'all' | 'info' | 'warn' | 'error' | 'security')}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                              filter === level
                                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-600'
                                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                      >
                        {level.toUpperCase()}
                      </button>
                  ))}
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  <button className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 transition-all hover:bg-gray-100 dark:hover:bg-gray-700">
                    <Filter className="w-4 h-4" />
                    Advanced Filter
                  </button>

                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        type="text"
                        placeholder="Search by IP, user, source, artifact..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-600 rounded-xl text-sm text-gray-900 dark:text-white outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#0d1117] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
                <div className="bg-[#161b22] px-6 py-3 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                  Audit Stream - {selectedProject.name}
                </span>
                </div>

                <div className="p-6 font-mono text-xs overflow-x-auto space-y-3 min-h-[460px]">
                  {filteredLogs.map((log) => (
                      <button
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className={`w-full group text-left rounded-lg px-2 py-1.5 transition-colors ${
                              selectedLog?.id === log.id ? 'bg-white/10' : 'hover:bg-white/5'
                          }`}
                      >
                        <div className="flex flex-wrap gap-x-4 gap-y-1 leading-relaxed">
                          <span className="text-gray-500 shrink-0 w-20">{log.timestamp.split(' ')[1]}</span>
                          <span className={`font-bold w-24 shrink-0 ${LEVEL_COLORS[log.level]}`}>
                        [{log.level.toUpperCase()}]
                      </span>
                          <span className="text-green-500 shrink-0 w-28">@{log.service}</span>
                          <span className="text-gray-300 group-hover:text-white transition-colors flex-1 min-w-[220px] whitespace-normal break-words">
                        {log.action} :: {log.message}{' '}
                            <span className="text-gray-500 italic">
                          actor={log.actor}; source={log.source}; result={log.result}; id={log.id}
                        </span>
                      </span>
                        </div>
                      </button>
                  ))}

                  <motion.div
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="flex gap-4 px-2"
                  >
                    <span className="text-blue-500">_</span>
                  </motion.div>
                </div>
              </div>
            </div>
          </main>
        </div>

        {selectedLog && (
            <div className="w-96 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shadow-xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <div>
                  <h3 className="text-gray-900 dark:text-white font-bold">Event Details</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{selectedLog.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <ExternalLink size={18} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                  </button>
                  <button
                      onClick={() => setSelectedLog(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X size={18} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6 space-y-6">
                <div className="flex gap-2 flex-wrap">
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${LEVEL_BADGES[selectedLog.level]}`}>
                {selectedLog.level.toUpperCase()}
              </span>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${SERVICE_BADGES[selectedLog.service]}`}>
                {selectedLog.service}
              </span>
                  <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                {selectedLog.result}
              </span>
                </div>

                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Action</label>
                  <div className="text-gray-900 dark:text-white px-1 leading-relaxed">{selectedLog.action}</div>
                </div>

                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Summary</label>
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white leading-relaxed">
                    {selectedLog.details}
                  </div>
                </div>

                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Actor</label>
                  <div className="space-y-2">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-gray-900 dark:text-white">{selectedLog.actor}</div>
                      <div className="text-gray-600 dark:text-gray-400 mt-1">{selectedLog.role}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Source & Target</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                      <Database size={18} className="text-gray-500 dark:text-gray-400" />
                      {selectedLog.source}
                    </div>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white leading-relaxed">
                      {selectedLog.target}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Log Message</label>
                  <div className="font-mono text-xs px-4 py-3 bg-[#0d1117] rounded-lg border border-gray-800 text-gray-300 leading-relaxed">
                    {selectedLog.timestamp} [{selectedLog.level.toUpperCase()}] @{selectedLog.service} {selectedLog.message}
                  </div>
                </div>

                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Changed / Recorded Fields</label>
                  <div className="space-y-2">
                    {selectedLog.fields.map((field) => (
                        <div key={field} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                          <UserCog size={18} className="text-gray-500 dark:text-gray-400" />
                          {field}
                        </div>
                    ))}
                  </div>
                </div>

                {(selectedLog.result === 'Blocked' || selectedLog.result === 'Failed') && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900">
                      <AlertTriangle size={20} className="text-yellow-700 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-yellow-800 dark:text-yellow-300 font-bold">Review recommended</div>
                        <p className="text-yellow-700 dark:text-yellow-400 mt-1">
                          Check permissions, source configuration, expired tokens, or project scope before retrying.
                        </p>
                      </div>
                    </div>
                )}
              </div>
            </div>
        )}
      </div>
  );
}
