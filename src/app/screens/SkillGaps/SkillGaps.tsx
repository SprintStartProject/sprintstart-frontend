import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Target, Zap, BrainCircuit, Award, ArrowRight } from 'lucide-react';

interface SkillGap {
  id: string;
  skill: string;
  category: string;
  proficiency: number; // 0 to 100
  targetProficiency: number;
  gap: number;
  usersAffected: number;
  status: 'Critical' | 'Warning' | 'Stable';
}

const MOCK_GAPS: SkillGap[] = [
  {
    id: '1',
    skill: 'AWS Architecture',
    category: 'Infrastructure',
    proficiency: 45,
    targetProficiency: 85,
    gap: 40,
    usersAffected: 12,
    status: 'Critical',
  },
  {
    id: '2',
    skill: 'React Design Patterns',
    category: 'Frontend',
    proficiency: 65,
    targetProficiency: 90,
    gap: 25,
    usersAffected: 8,
    status: 'Warning',
  },
  {
    id: '3',
    skill: 'Data Privacy (GDPR)',
    category: 'Compliance',
    proficiency: 88,
    targetProficiency: 100,
    gap: 12,
    usersAffected: 45,
    status: 'Stable',
  },
  {
    id: '4',
    skill: 'Go Concurrency',
    category: 'Backend',
    proficiency: 30,
    targetProficiency: 80,
    gap: 50,
    usersAffected: 5,
    status: 'Critical',
  },
  {
    id: '5',
    skill: 'Agile Methodologies',
    category: 'Process',
    proficiency: 75,
    targetProficiency: 85,
    gap: 10,
    usersAffected: 24,
    status: 'Stable',
  },
];

export default function SkillGaps() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col min-h-full bg-gray-50 dark:bg-gray-950">
      <header className="px-6 md:px-8 py-4 md:py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-purple-600" />
            {t('skill_gaps.title')}
          </h1>
          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium">
            {t('skill_gaps.subtitle')}
          </p>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6 md:space-y-8">
        {/* Top Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 bg-gradient-to-br from-purple-600 to-indigo-700 p-6 md:p-8 rounded-2xl md:rounded-3xl text-white shadow-xl shadow-purple-200 dark:shadow-none relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full -mr-10 -mt-10" />
            <div className="flex items-start justify-between mb-6 md:mb-8 relative z-10">
              <div>
                <h2 className="text-xl md:text-2xl font-black mb-2">
                  {t('skill_gaps.priority_title', { skill: 'AWS' })}
                </h2>
                <p className="text-purple-100 text-xs md:text-sm max-w-md leading-relaxed">
                  {t('skill_gaps.priority_desc', { count: 12 })}
                </p>
              </div>
              <Zap className="w-8 h-8 md:w-10 md:h-10 text-yellow-400 fill-yellow-400 animate-pulse shrink-0 ml-2" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 relative z-10">
              <button className="w-full sm:w-auto px-6 py-2.5 bg-white text-purple-600 rounded-xl text-sm font-bold hover:bg-purple-50 transition-all shadow-lg active:scale-95">
                {t('skill_gaps.actions.start_training')}
              </button>
              <button className="w-full sm:w-auto px-6 py-2.5 bg-purple-500/30 text-white rounded-xl text-sm font-bold border border-white/20 hover:bg-purple-500/40 transition-all active:scale-95">
                {t('skill_gaps.actions.view_curriculums')}
              </button>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-center text-center">
            <Award className="w-10 h-10 md:w-12 md:h-12 text-blue-600 mx-auto mb-3 md:mb-4" />
            <p className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">84%</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
              {t('skill_gaps.stats.org_proficiency')}
            </p>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full mt-5 md:mt-6 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '84%' }}
                className="h-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]"
              />
            </div>
          </div>
        </div>

        {/* Skill Table (Desktop) / Cards (Mobile) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    {t('skill_gaps.table.skill_category')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    {t('skill_gaps.table.proficiency_gap')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    {t('skill_gaps.table.affected_users')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    {t('skill_gaps.table.status')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    {t('skill_gaps.table.action')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {MOCK_GAPS.map((gap) => (
                  <tr
                    key={gap.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 group-hover:text-blue-500 transition-colors">
                          <Target className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {gap.skill}
                          </p>
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                            {gap.category}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="w-full max-w-[160px]">
                        <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold">
                          <span className="text-gray-400">
                            {t('skill_gaps.table.current')}: {gap.proficiency}%
                          </span>
                          <span className="text-blue-600">
                            {t('skill_gaps.table.target')}: {gap.targetProficiency}%
                          </span>
                        </div>
                        <div className="relative h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gray-300 dark:bg-gray-600 rounded-full"
                            style={{ width: `${gap.proficiency}%` }}
                          />
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${gap.targetProficiency - gap.proficiency}%` }}
                            className="absolute inset-y-0 bg-blue-500/40"
                            style={{ left: `${gap.proficiency}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex -space-x-2">
                        {[...Array(Math.min(3, gap.usersAffected))].map((_, i) => (
                          <div
                            key={i}
                            className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-900 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[8px] font-bold text-gray-400"
                          >
                            U{i}
                          </div>
                        ))}
                        {gap.usersAffected > 3 && (
                          <div className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-900 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-400">
                            +{gap.usersAffected - 3}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          gap.status === 'Critical'
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600'
                            : gap.status === 'Warning'
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                              : 'bg-green-50 dark:bg-green-900/20 text-green-600'
                        }`}
                      >
                        {t(`skill_gaps.status.${gap.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <button className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                        {t('skill_gaps.actions.mitigate')}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {MOCK_GAPS.map((gap) => (
              <div key={gap.id} className="p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 shrink-0">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {gap.skill}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {gap.category}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                      gap.status === 'Critical'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-100 dark:border-red-900/50'
                        : gap.status === 'Warning'
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-100 dark:border-amber-900/50'
                          : 'bg-green-50 dark:bg-green-900/20 text-green-600 border border-green-100 dark:border-green-900/50'
                    }`}
                  >
                    {t(`skill_gaps.status.${gap.status}`)}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tighter">
                    <span className="text-gray-500">{t('skill_gaps.table.current_progress')}</span>
                    <span className="text-blue-600">
                      {t('skill_gaps.table.target')}: {gap.targetProficiency}%
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gray-300 dark:bg-gray-600 rounded-full"
                      style={{ width: `${gap.proficiency}%` }}
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${gap.targetProficiency - gap.proficiency}%` }}
                      className="absolute inset-y-0 bg-blue-500/40"
                      style={{ left: `${gap.proficiency}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1.5">
                      {[...Array(Math.min(3, gap.usersAffected))].map((_, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[7px] font-black text-gray-500"
                        >
                          U{i}
                        </div>
                      ))}
                      {gap.usersAffected > 3 && (
                        <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[7px] font-black text-gray-600 dark:text-gray-400">
                          +{gap.usersAffected - 3}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                      {t('skill_gaps.table.members_affected', { count: gap.usersAffected })}
                    </span>
                  </div>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform">
                    {t('skill_gaps.actions.mitigate')}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
