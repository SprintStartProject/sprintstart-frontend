import { MetricCard } from '../../components/MetricCard';
import { ProgressBar } from '../../components/ProgressBar';
import {
  Users,
  BookOpen,
  AlertCircle,
  TrendingUp,
  CheckCircle,
  Clock,
  FileText,
  Activity,
} from 'lucide-react';

export function Dashboard() {
  const metrics = [
    {
      title: 'Active Users',
      value: '247',
      change: '+12% from last month',
      trend: 'up' as const,
      icon: Users,
    },
    {
      title: 'Knowledge Items',
      value: '1,849',
      change: '+156 this week',
      trend: 'up' as const,
      icon: BookOpen,
    },
    {
      title: 'Open Gaps',
      value: '23',
      change: '5 critical',
      trend: 'down' as const,
      icon: AlertCircle,
    },
    {
      title: 'Completion Rate',
      value: '87%',
      change: '+5% improvement',
      trend: 'up' as const,
      icon: TrendingUp,
    },
  ];

  const recentActivity = [
    { user: 'Sarah Chen', action: 'completed', item: 'Week 1 Onboarding', time: '5 minutes ago' },
    {
      user: 'Marcus Johnson',
      action: 'asked',
      item: 'How do we handle API authentication?',
      time: '12 minutes ago',
    },
    {
      user: 'Emma Wilson',
      action: 'uploaded',
      item: 'Q1 Architecture Decision Record',
      time: '1 hour ago',
    },
    {
      user: 'David Park',
      action: 'started',
      item: 'Backend Development Path',
      time: '2 hours ago',
    },
  ];

  const onboardingProgress = [
    { name: 'Day 1 Essentials', completed: 45, total: 45, status: 'complete' },
    { name: 'Week 1 Foundation', completed: 28, total: 32, status: 'active' },
    { name: 'Month 1 Integration', completed: 8, total: 24, status: 'upcoming' },
  ];

  const knowledgeGaps = [
    { area: 'Deployment Pipeline', severity: 'critical', affected: 12 },
    { area: 'Authentication Flow', severity: 'high', affected: 8 },
    { area: 'Database Schema', severity: 'medium', affected: 5 },
    { area: 'Error Handling', severity: 'low', affected: 3 },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Overview of team onboarding and knowledge status
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Onboarding Progress */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Onboarding Progress
            </h2>
          </div>
          <div className="space-y-6">
            {onboardingProgress.map((phase) => (
              <div key={phase.name}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {phase.name}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        phase.status === 'complete'
                          ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                          : phase.status === 'active'
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {phase.status}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {phase.completed}/{phase.total}
                  </span>
                </div>
                <ProgressBar value={phase.completed} max={phase.total} />
              </div>
            ))}
          </div>
        </div>

        {/* Knowledge Gaps */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Knowledge Gaps</h2>
          </div>
          <div className="space-y-4">
            {knowledgeGaps.map((gap) => (
              <div
                key={gap.area}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-800"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {gap.area}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      gap.severity === 'critical'
                        ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                        : gap.severity === 'high'
                          ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400'
                          : gap.severity === 'medium'
                            ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {gap.severity}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {gap.affected} users affected
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Activity</h2>
        </div>
        <div className="space-y-4">
          {recentActivity.map((activity, index) => (
            <div
              key={index}
              className="flex items-start gap-4 pb-4 border-b border-gray-200 dark:border-gray-800 last:border-0 last:pb-0"
            >
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white">
                  <span className="font-medium">{activity.user}</span> {activity.action}{' '}
                  <span className="font-medium">{activity.item}</span>
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
