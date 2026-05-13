import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  Video,
  Link2,
  ChevronRight,
  Sparkles,
  Trophy,
  PlayCircle,
  Target,
} from 'lucide-react';

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

  const [selectedPhase, setSelectedPhase] = useState(0);

  const phases: OnboardingPhase[] = useMemo(
    () => [
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
    ],
    [t],
  );

  const getIcon = (type: OnboardingItem['type']) => {
    switch (type) {
      case 'document':
        return FileText;
      case 'video':
        return Video;
      case 'link':
        return Link2;
      default:
        return Target;
    }
  };

  const calculateProgress = (items: OnboardingItem[]) => {
    const completed = items.filter((item) => item.completed).length;

    return {
      completed,
      total: items.length,
      percentage: Math.round((completed / items.length) * 100),
    };
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

  const currentPhase = phases[selectedPhase];

  const nextTask =
    phases
      .flatMap((phase) => phase.items)
      .find((item) => !item.completed) ?? null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="grid grid-cols-[300px_minmax(0,1fr)]">
        {/* SIDEBAR */}
        <aside className="border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('onboarding.journey_title')}
              </h1>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('onboarding.journey_subtitle')}
            </p>
          </div>

          {/* Overall Card */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm opacity-80">
                  {t('onboarding.overall_progress')}
                </div>

                <div className="text-3xl font-bold mt-1">
                  {Math.round(
                    (totalProgress.completed / totalProgress.total) * 100,
                  )}
                  %
                </div>
              </div>

              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Trophy className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white/20 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{
                  width: `${Math.round(
                    (totalProgress.completed / totalProgress.total) * 100,
                  )}%`,
                }}
              />
            </div>

            <div className="text-xs mt-3 opacity-80">
              {totalProgress.completed} / {totalProgress.total} completed
            </div>
          </div>

          {/* Phase Navigation */}
          <div className="space-y-3">
            {phases.map((phase, index) => {
              const progress = calculateProgress(phase.items);

              const isSelected = selectedPhase === index;

              return (
                <button
                  key={phase.id}
                  onClick={() => setSelectedPhase(index)}
                  className={`w-full text-left rounded-2xl border transition-all p-4 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {phase.title}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {phase.period}
                      </div>
                    </div>

                    <div
                      className={`text-xs px-2 py-1 rounded-full ${
                        progress.percentage === 100
                          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                          : isSelected
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {progress.percentage}%
                    </div>
                  </div>

                  <ProgressBar
                    value={progress.completed}
                    max={progress.total}
                  />
                </button>
              );
            })}
          </div>
        </aside>

        {/* MAIN */}
        <main className="p-8">
          {/* Hero */}
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 mb-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full" />

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs font-medium mb-4">
                    <Sparkles className="w-3.5 h-3.5" />
                    Current Phase
                  </div>

                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {currentPhase.title}
                  </h2>

                  <p className="text-gray-600 dark:text-gray-400 mt-3 max-w-2xl">
                    {currentPhase.description}
                  </p>
                </div>

                <div className="hidden lg:flex flex-col items-end">
                  <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">
                    {calculateProgress(currentPhase.items).percentage}%
                  </div>

                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    completed
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <ProgressBar
                  value={calculateProgress(currentPhase.items).completed}
                  max={calculateProgress(currentPhase.items).total}
                  size="lg"
                />
              </div>
            </div>
          </div>

          {/* NEXT TASK */}
          {nextTask && (
            <div className="mb-8 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-5 flex items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <PlayCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-400 font-semibold mb-1">
                    Next Recommended Step
                  </div>

                  <div className="font-semibold text-gray-900 dark:text-white">
                    {nextTask.title}
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {nextTask.description}
                  </div>
                </div>
              </div>

              <button className="shrink-0 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all flex items-center gap-2">
                Start
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TASKS */}
          <div className="space-y-4">
            {currentPhase.items.map((item) => {
              const Icon = getIcon(item.type);

              return (
                <div
                  key={item.id}
                  className={`group rounded-2xl border transition-all ${
                    item.completed
                      ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 opacity-70'
                      : 'border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-gray-900 hover:shadow-lg'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex gap-4">
                      <div className="pt-1">
                        {item.completed ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <Circle className="w-6 h-6 text-blue-500" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-6">
                          <div>
                            <h3
                              className={`font-semibold text-base ${
                                item.completed
                                  ? 'line-through text-gray-500 dark:text-gray-500'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                            >
                              {item.title}
                            </h3>

                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                              {item.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 mt-4">
                              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                <Icon className="w-4 h-4" />
                                <span className="text-xs capitalize">
                                  {item.type}
                                </span>
                              </div>

                              {item.duration && (
                                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                  <Clock3 className="w-4 h-4" />
                                  <span className="text-xs">
                                    {item.duration}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {!item.completed && (
                            <button className="shrink-0 px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all text-sm font-medium flex items-center gap-2">
                              Start
                              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}