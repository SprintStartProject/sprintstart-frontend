import { useMemo, useRef, useState } from 'react';
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
  ArrowLeft,
  MessageSquare,
  BookOpen,
  ExternalLink,
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

function OnboardingIcon({ type, className }: { type: OnboardingItem['type']; className?: string }) {
  switch (type) {
    case 'document':
      return <FileText className={className} />;
    case 'video':
      return <Video className={className} />;
    case 'link':
      return <Link2 className={className} />;
    default:
      return <Target className={className} />;
  }
}

export function Onboarding() {
  const { t } = useTranslation();

  const [selectedPhase, setSelectedPhase] = useState(0);

  // NEW
  const [activeStep, setActiveStep] = useState<OnboardingItem | null>(null);

  const [completedSubtasks, setCompletedSubtasks] = useState<string[]>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const tasksRef = useRef<HTMLDivElement | null>(null);

  const toggleSubtask = (task: string) => {
    setCompletedSubtasks((prev) =>
        prev.includes(task)
            ? prev.filter((t) => t !== task)
            : [...prev, task],
    );
  };

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
              description: t(
                  'onboarding.phases.day1.items.hr_paperwork.description',
              ),
              type: 'task',
              completed: true,
            },
            {
              id: '2',
              title: t(
                  'onboarding.phases.day1.items.company_overview.title',
              ),
              description: t(
                  'onboarding.phases.day1.items.company_overview.description',
              ),
              type: 'video',
              completed: true,
              duration: '15 min',
            },
            {
              id: '3',
              title: t('onboarding.phases.day1.items.handbook.title'),
              description: t(
                  'onboarding.phases.day1.items.handbook.description',
              ),
              type: 'document',
              completed: true,
              duration: '30 min',
            },
            {
              id: '4',
              title: t('onboarding.phases.day1.items.dev_env.title'),
              description: t(
                  'onboarding.phases.day1.items.dev_env.description',
              ),
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
              description: t(
                  'onboarding.phases.week1.items.architecture.description',
              ),
              type: 'document',
              completed: true,
              duration: '45 min',
            },
            {
              id: '7',
              title: t('onboarding.phases.week1.items.first_feature.title'),
              description: t(
                  'onboarding.phases.week1.items.first_feature.description',
              ),
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
              description: t(
                  'onboarding.phases.week1.items.code_review.description',
              ),
              type: 'document',
              completed: false,
              duration: '15 min',
            },
            {
              id: '10',
              title: t('onboarding.phases.week1.items.standup.title'),
              description: t(
                  'onboarding.phases.week1.items.standup.description',
              ),
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
              description: t(
                  'onboarding.phases.month1.items.lead_feature.description',
              ),
              type: 'task',
              completed: false,
            },
            {
              id: '12',
              title: t('onboarding.phases.month1.items.database.title'),
              description: t(
                  'onboarding.phases.month1.items.database.description',
              ),
              type: 'document',
              completed: false,
              duration: '40 min',
            },
            {
              id: '13',
              title: t('onboarding.phases.month1.items.security.title'),
              description: t(
                  'onboarding.phases.month1.items.security.description',
              ),
              type: 'document',
              completed: false,
              duration: '25 min',
            },
            {
              id: '14',
              title: t('onboarding.phases.month1.items.presentation.title'),
              description: t(
                  'onboarding.phases.month1.items.presentation.description',
              ),
              type: 'task',
              completed: false,
            },
          ],
        },
      ],
      [t],
  );

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

  // --------------------------------------------------------------------------
  // STEP DETAIL VIEW
  // --------------------------------------------------------------------------

  if (activeStep) {
    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 p-8">
          <div className="max-w-5xl mx-auto">
            {/* BACK */}
            <button
                onClick={() => setActiveStep(null)}
                className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to onboarding
            </button>

            {/* HERO */}
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 mb-8 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 blur-3xl rounded-full" />

              <div className="relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs font-medium mb-4">
                      <OnboardingIcon type={activeStep.type} className="w-3.5 h-3.5" />
                      Mock Learning Experience
                    </div>

                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                      {activeStep.title}
                    </h1>

                    <p className="text-gray-600 dark:text-gray-400 mt-4 max-w-3xl">
                      {activeStep.description}
                    </p>
                  </div>

                  {activeStep.duration && (
                      <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400">
                        <Clock3 className="w-4 h-4" />
                        {activeStep.duration}
                      </div>
                  )}
                </div>
              </div>
            </div>

            {/* OUTCOME */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    After this step you can...
                  </h2>
                </div>

                <div className="space-y-4">
                  {[
                    'Understand the internal workflow and tooling',
                    'Navigate the project architecture confidently',
                    'Collaborate better with your team',
                    'Complete related onboarding tasks independently',
                  ].map((item) => (
                      <div
                          key={item}
                          className="flex items-start gap-3 rounded-2xl bg-gray-50 dark:bg-gray-900 p-4"        
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />

                        <span className="text-sm text-gray-700 dark:text-gray-300">
                      {item}
                    </span>
                      </div>
                  ))}
                </div>
              </div>

              {/* KNOWLEDGE BASE */}
              <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <BookOpen className="w-5 h-5 text-indigo-500" />

                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Knowledge Base
                  </h2>
                </div>

                <div className="space-y-3">
                  {[
                    'Architecture Overview',
                    'Engineering Handbook',
                    'CI/CD Docs',
                    'Security Best Practices',
                  ].map((article) => (
                      <button
                          key={article}
                          className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-all text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {article}
                            </div>

                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Internal article
                            </div>
                          </div>

                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                        </div>
                      </button>
                  ))}
                </div>

                <button
                    onClick={() => {
                      window.location.href = '/knowledge';
                    }}
                    className="w-full mt-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white py-3 text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  Open Knowledge Base
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* STEP BY STEP */}
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 mb-8">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-orange-500" />

                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Step-by-step Tasks
                </h2>
              </div>

              <div className="space-y-4">
                {[
                  'Read the onboarding material',
                  'Watch the introduction walkthrough',
                  'Complete the interactive checklist',
                  'Review best practices',
                ].map((todo, index) => {
                  const checked = completedSubtasks.includes(todo);

                  return (
                      <button
                          key={todo}
                          onClick={() => toggleSubtask(todo)}
                          className={`w-full text-left flex items-start gap-4 rounded-2xl border transition-all p-4 ${checked
                              ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20'       
                              : 'border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                          }`}
                      >
                        <div className="pt-0.5">
                          {checked ? (
                              <CheckCircle2 className="w-6 h-6 text-green-500" />
                          ) : (
                              <Circle className="w-6 h-6 text-gray-400" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div
                              className={`font-medium ${checked
                                  ? 'text-green-700 dark:text-green-400 line-through'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                          >
                            {index + 1}. {todo}
                          </div>

                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Dummy explanation text for this onboarding action.
                          </div>
                        </div>
                      </button>
                  );
                })}
              </div>
            </div>

            {/* FINAL TASK */}
            <div className="rounded-3xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 p-6 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="w-6 h-6 text-green-600 dark:text-green-400" />

                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Final Task
                  </h2>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Complete this task to finish the onboarding step.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-black border border-green-200 dark:border-green-900 p-5">
                <div className="font-semibold text-gray-900 dark:text-white">
                  Create your first onboarding summary
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Write a short summary about what you learned and share it with
                  your onboarding buddy.
                </p>

                <button className="mt-5 px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-all flex items-center gap-2">
                  Complete Task
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* FEEDBACK */}
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden mb-24">
              <button
                  onClick={() => setFeedbackOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-pink-500" />

                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Feedback
                  </h2>
                </div>

                <ChevronRight
                    className={`w-5 h-5 text-gray-400 transition-transform ${feedbackOpen ? 'rotate-90' : ''    
                    }`}
                />
              </button>

              {feedbackOpen && (
                  <div className="px-6 pb-6">
                    <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                      Optional: leave feedback for this onboarding step.
                    </div>

                    <textarea
                        placeholder="Leave feedback for this onboarding step..."
                        className="w-full min-h-[140px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />

                    <div className="flex justify-end mt-4">
                      <button className="px-5 py-3 rounded-xl bg-gray-900 dark:bg-white dark:text-black text-white text-sm font-medium hover:opacity-90 transition-all">
                        Submit Feedback
                      </button>
                    </div>
                  </div>
              )}
            </div>
          </div>
          <div>
            <br></br>
            <br></br>

          </div>
        </div>
    );
  }

  // --------------------------------------------------------------------------
  // DEFAULT VIEW
  // --------------------------------------------------------------------------

  return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {/* TOP HEADER */}
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t('onboarding.journey_title')}
                  </h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('onboarding.journey_subtitle')}
                </p>
              </div>

              <div className="text-right">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round((totalProgress.completed / totalProgress.total) * 100)}%
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">overall progress</div>
              </div>
            </div>

            {/* GLOBAL BAR */}
            <div className="bg-gray-200 dark:bg-gray-800 rounded-full h-3 overflow-hidden mb-5">
              <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all"   
                  style={{
                    width: `${Math.round((totalProgress.completed / totalProgress.total) * 100)}%`,
              }}
            />
          </div>

          {/* PHASES */}
          <div className="flex flex-col sm:flex-row gap-3">
            {phases.map((phase, index) => {
              const progress = calculateProgress(phase.items);
              const isSelected = selectedPhase === index;

              return (
                <button
                  key={phase.id}
                  onClick={() => {
                    setSelectedPhase(index);

                    setTimeout(() => {
                      tasksRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }, 50);
                  }}
                  className={`flex-1 rounded-2xl border p-4 transition-all text-left ${isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                >
                  {/* TITLE */}
                  <div className="mb-4">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {phase.title}
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {phase.period}
                    </div>
                  </div>

                  {/* BAR */}
                  <ProgressBar
                    value={progress.completed}
                    max={progress.total}
                  />

                  {/* FOOTER */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {progress.completed}/{progress.total} tasks
                    </div>

                    <div
                      className={`text-xs px-2 py-1 rounded-full ${progress.percentage === 100
                          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      {progress.percentage}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        </div>

        {/* MAIN CONTENT — list view only; detail view is handled by the early return above */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
          {/* HERO */}
          {nextTask && (
                <div className="rounded-3xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-gray-950 p-5 sm:p-8 mb-6 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full" />     
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs font-medium mb-4">
                      <PlayCircle className="w-3.5 h-3.5" />
                      Up Next
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                      {nextTask.title}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-3 max-w-2xl">
                      {nextTask.description}
                    </p>
                    <div className="flex items-center gap-4 mt-6">
                      <button
                          onClick={() => setActiveStep(nextTask)}
                          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all flex items-center gap-2"
                      >
                        Start Now
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">        
                        <div className="flex items-center gap-1.5">
                          <OnboardingIcon type={nextTask.type} className="w-4 h-4" />
                          <span className="capitalize">{nextTask.type}</span>
                        </div>
                        {nextTask.duration && (
                            <>
                              <span>·</span>
                              <div className="flex items-center gap-1.5">
                                <Clock3 className="w-4 h-4" />
                                {nextTask.duration}
                              </div>
                            </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
            )}

        {/* TASKS */}
        <div
          ref={tasksRef}
          className="space-y-4"
        >
          {currentPhase.items.map((item) => (
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
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">   
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
                                  <OnboardingIcon type={item.type} className="w-4 h-4" />
                                  <span className="text-xs capitalize">{item.type}</span>
                                </div>
                                {item.duration && (
                                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                      <Clock3 className="w-4 h-4" />
                                      <span className="text-xs">{item.duration}</span>
                                    </div>
                                )}
                              </div>
                            </div>

                            <button
                                onClick={() => setActiveStep(item)}
                                className="shrink-0 px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all text-sm font-medium flex items-center gap-2"
                            >
                              Start
                              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              ))}
          </div>
        </main>
      </div>
  );
}
