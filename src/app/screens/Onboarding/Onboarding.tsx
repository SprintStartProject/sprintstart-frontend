import { useMemo } from 'react';
import { CheckCircle, Circle, Clock, FileText, Video, Link2, ChevronRight } from 'lucide-react';
import { ProgressBar } from '../../components/ProgressBar';
import { useTranslation } from 'react-i18next';

interface OnboardingItem {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'video' | 'link' | 'task';
  completed: boolean;
  duration?: string;
}

interface OnboardingPhase {
  id: string;
  title: string;
  description: string;
  period: string;
  items: OnboardingItem[];
}

export function Onboarding() {
  const { t } = useTranslation();

  const phases: OnboardingPhase[] = useMemo(() => [
    {
      id: 'day1',
      title: t('onboarding.phases.day1.title'),
      description: t('onboarding.phases.day1.description'),
      period: t('onboarding.phases.day1.period'),
      items: [
        {
          id: '1',
          title: t('onboarding.phases.day1.items.hr_paperwork.title'),
          description: t('onboarding.phases.day1.items.hr_paperwork.description'),
          type: 'task',
          completed: true,
        },
        {
          id: '2',
          title: t('onboarding.phases.day1.items.company_overview.title'),
          description: t('onboarding.phases.day1.items.company_overview.description'),
          type: 'video',
          completed: true,
          duration: '15 min',
        },
        {
          id: '3',
          title: t('onboarding.phases.day1.items.handbook.title'),
          description: t('onboarding.phases.day1.items.handbook.description'),
          type: 'document',
          completed: true,
          duration: '30 min',
        },
        {
          id: '4',
          title: t('onboarding.phases.day1.items.dev_env.title'),
          description: t('onboarding.phases.day1.items.dev_env.description'),
          type: 'task',
          completed: true,
        },
        {
          id: '5',
          title: t('onboarding.phases.day1.items.buddy.title'),
          description: t('onboarding.phases.day1.items.buddy.description'),
          type: 'task',
          completed: true,
          duration: '30 min',
        },
      ],
    },
    {
      id: 'week1',
      title: t('onboarding.phases.week1.title'),
      description: t('onboarding.phases.week1.description'),
      period: t('onboarding.phases.week1.period'),
      items: [
        {
          id: '6',
          title: t('onboarding.phases.week1.items.architecture.title'),
          description: t('onboarding.phases.week1.items.architecture.description'),
          type: 'document',
          completed: true,
          duration: '45 min',
        },
        {
          id: '7',
          title: t('onboarding.phases.week1.items.first_feature.title'),
          description: t('onboarding.phases.week1.items.first_feature.description'),
          type: 'task',
          completed: true,
        },
        {
          id: '8',
          title: t('onboarding.phases.week1.items.cicd.title'),
          description: t('onboarding.phases.week1.items.cicd.description'),
          type: 'video',
          completed: false,
          duration: '20 min',
        },
        {
          id: '9',
          title: t('onboarding.phases.week1.items.code_review.title'),
          description: t('onboarding.phases.week1.items.code_review.description'),
          type: 'document',
          completed: false,
          duration: '15 min',
        },
        {
          id: '10',
          title: t('onboarding.phases.week1.items.standup.title'),
          description: t('onboarding.phases.week1.items.standup.description'),
          type: 'task',
          completed: false,
        },
      ],
    },
    {
      id: 'month1',
      title: t('onboarding.phases.month1.title'),
      description: t('onboarding.phases.month1.description'),
      period: t('onboarding.phases.month1.period'),
      items: [
        {
          id: '11',
          title: t('onboarding.phases.month1.items.lead_feature.title'),
          description: t('onboarding.phases.month1.items.lead_feature.description'),
          type: 'task',
          completed: false,
        },
        {
          id: '12',
          title: t('onboarding.phases.month1.items.database.title'),
          description: t('onboarding.phases.month1.items.database.description'),
          type: 'document',
          completed: false,
          duration: '40 min',
        },
        {
          id: '13',
          title: t('onboarding.phases.month1.items.security.title'),
          description: t('onboarding.phases.month1.items.security.description'),
          type: 'document',
          completed: false,
          duration: '25 min',
        },
        {
          id: '14',
          title: t('onboarding.phases.month1.items.presentation.title'),
          description: t('onboarding.phases.month1.items.presentation.description'),
          type: 'task',
          completed: false,
        },
      ],
    },
  ], [t]);

  const getIcon = (type: OnboardingItem['type']) => {
    switch (type) {
      case 'document':
        return FileText;
      case 'video':
        return Video;
      case 'link':
        return Link2;
      default:
        return CheckCircle;
    }
  };

  const calculateProgress = (items: OnboardingItem[]) => {
    const completed = items.filter((item) => item.completed).length;
    return { completed, total: items.length, percentage: (completed / items.length) * 100 };
  };

  const totalProgress = phases.reduce(
    (acc, phase) => {
      const progress = calculateProgress(phase.items);
      return {
        completed: acc.completed + progress.completed,
        total: acc.total + progress.total,
      };
    },
    { completed: 0, total: 0 },
  );

  if (phases.length === 0) return null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('onboarding.journey_title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('onboarding.journey_subtitle')}
        </p>
      </div>

      {/* Overall Progress */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('onboarding.overall_progress')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('onboarding.items_completed', { completed: totalProgress.completed, total: totalProgress.total })}
            </p>
          </div>
          <div className="text-3xl font-semibold text-blue-600 dark:text-blue-400">
            {totalProgress.total > 0 ? Math.round((totalProgress.completed / totalProgress.total) * 100) : 0}%
          </div>
        </div>
        <ProgressBar value={totalProgress.completed} max={totalProgress.total} size="lg" />
      </div>

      {/* Phases */}
      <div className="space-y-6">
        {phases.map((phase, phaseIndex) => {
          const progress = calculateProgress(phase.items);
          const isComplete = progress.completed === progress.total;
          const isActive =
            (!isComplete && phaseIndex === 0) ||
            (phaseIndex > 0 &&
              calculateProgress(phases[phaseIndex - 1].items).completed ===
                phases[phaseIndex - 1].items.length &&
              !isComplete);

          return (
            <div
              key={phase.id}
              className={`bg-white dark:bg-gray-900 border rounded-lg overflow-hidden ${
                isActive
                  ? 'border-blue-500 dark:border-blue-500 shadow-lg'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              {/* Phase Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {phase.title}
                      </h3>
                      {isComplete && (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 text-xs rounded-full">
                          {t('onboarding.status.complete')}
                        </span>
                      )}
                      {isActive && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                          {t('onboarding.status.active')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{phase.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {progress.completed}/{progress.total}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{phase.period}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <ProgressBar value={progress.completed} max={progress.total} />
                </div>
              </div>

              {/* Phase Items */}
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {phase.items.map((item) => {
                  const Icon = getIcon(item.type);
                  return (
                    <div
                      key={item.id}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        item.completed ? 'opacity-75' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="pt-1">
                          {item.completed ? (
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4
                                className={`text-sm font-medium ${
                                  item.completed
                                    ? 'text-gray-600 dark:text-gray-400 line-through'
                                    : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {item.title}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {item.description}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <div className="flex items-center gap-1.5">
                                  <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                                  <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                                    {item.type}
                                  </span>
                                </div>
                                {item.duration && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                                      <span className="text-xs text-gray-600 dark:text-gray-400">
                                        {item.duration}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            {!item.completed && (
                              <button className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors flex items-center gap-1">
                                {t('onboarding.status.start')}
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Next Steps */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
          {t('onboarding.next_step_title')}
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-400">
          {t('onboarding.next_step_desc')}
        </p>
      </div>
    </div>
  );
}
