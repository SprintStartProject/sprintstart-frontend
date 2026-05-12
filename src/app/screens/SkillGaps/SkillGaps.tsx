import { motion } from 'motion/react';
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
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <header className="px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-purple-600" />
            Skill Gaps Analysis
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Identifying and bridging the gap between current and target team capabilities
          </p>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Top Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gradient-to-br from-purple-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl shadow-purple-200 dark:shadow-none">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black mb-2">Priority: AWS Training</h2>
                <p className="text-purple-100 text-sm max-w-md">
                  12 team members are currently below the required proficiency for our upcoming Q4
                  infrastructure migration.
                </p>
              </div>
              <Zap className="w-10 h-10 text-yellow-400 fill-yellow-400 animate-pulse" />
            </div>
            <div className="flex gap-4">
              <button className="px-6 py-2.5 bg-white text-purple-600 rounded-xl text-sm font-bold hover:bg-purple-50 transition-all">
                Start Training Path
              </button>
              <button className="px-6 py-2.5 bg-purple-500/30 text-white rounded-xl text-sm font-bold border border-white/20 hover:bg-purple-500/40 transition-all">
                View Curriculums
              </button>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-center text-center">
            <Award className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <p className="text-3xl font-black text-gray-900 dark:text-white">84%</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
              Org Proficiency
            </p>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full mt-6 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '84%' }}
                className="h-full bg-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Skill Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Skill & Category
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Proficiency Gap
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Affected Users
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Status
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Action
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
                      <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400">
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
                        <span className="text-gray-400">Current: {gap.proficiency}%</span>
                        <span className="text-blue-600">Target: {gap.targetProficiency}%</span>
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
                      {gap.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <button className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                      Mitigate
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
