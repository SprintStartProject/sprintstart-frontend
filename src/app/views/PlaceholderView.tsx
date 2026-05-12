import { LucideIcon, Rocket, Sparkles, Bell, ShieldCheck, Zap, Database } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

interface PlaceholderViewProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function PlaceholderView({ title, description, icon: Icon }: PlaceholderViewProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Determine skeleton type based on title keywords
  const getSkeletonType = () => {
    const t = title.toLowerCase();
    if (t.includes('stat') || t.includes('quality') || t.includes('dashboard')) return 'stats';
    if (t.includes('log') || t.includes('access') || t.includes('data')) return 'table';
    return 'grid';
  };

  const skeletonType = getSkeletonType();

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      {/* Module Header */}
      <header className="px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
              {Icon ? (
                <Icon className="w-6 h-6 text-white" />
              ) : (
                <Rocket className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                  {title}
                </h1>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-blue-200 dark:border-blue-800">
                  Coming Q3
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1 uppercase tracking-[0.15em]">
                SprintStart Enterprise
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-400 font-medium">12 teams waiting</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-12 max-w-6xl mx-auto w-full space-y-12">
        {/* Intro Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-full text-xs font-bold border border-amber-100 dark:border-amber-800/50">
              <Zap className="w-3.5 h-3.5" />
              <span>Next-Gen Analytics Engine</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white leading-[1.1] tracking-tight">
              Predictive Insights for <span className="text-blue-600">High-Velocity</span> Teams.
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-lg">
              {description}
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              {!isSubscribed ? (
                <div className="flex w-full max-w-md bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl p-1 focus-within:border-blue-600 transition-all shadow-sm">
                  <input
                    type="email"
                    placeholder="Enter email for beta access..."
                    className="flex-1 px-4 py-2 bg-transparent text-sm outline-none"
                  />
                  <button
                    onClick={() => setIsSubscribed(true)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                  >
                    Notify Me
                    <Bell className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-3 px-6 py-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-2xl border-2 border-green-100 dark:border-green-800/50 font-bold text-sm"
                >
                  <ShieldCheck className="w-5 h-5" />
                  You&apos;re on the list! We&apos;ll reach out soon.
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Visual Mock/Skeleton */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-200 dark:border-gray-800 p-8 shadow-2xl shadow-blue-100 dark:shadow-none min-h-[400px]">
              {skeletonType === 'stats' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl space-y-3"
                      >
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg" />
                        <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="w-2/3 h-8 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                  <div className="h-48 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex items-end justify-between p-6 gap-2">
                    {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: i * 0.1, duration: 1 }}
                        className="w-full bg-blue-600/20 dark:bg-blue-600/40 rounded-t-lg relative group"
                      >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600 rounded-full" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {skeletonType === 'table' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="w-24 h-8 bg-blue-600/10 dark:bg-blue-600/20 rounded-lg" />
                  </div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-gray-800"
                    >
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="w-1/3 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="w-1/2 h-2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                      </div>
                      <div className="w-16 h-4 bg-gray-50 dark:bg-gray-800 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {skeletonType === 'grid' && (
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-6 border border-gray-100 dark:border-gray-800 rounded-3xl space-y-4"
                    >
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                      <div className="space-y-2">
                        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="w-2/3 h-2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Floating Badge */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="absolute -top-6 -right-6 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 flex items-center gap-3 z-20"
            >
              <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                  Status
                </p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">98% Optimized</p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Features Preview Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              label: 'Real-time Sync',
              icon: Database,
              desc: 'Direct ingestion from all 12 enterprise data sources.',
            },
            {
              label: 'AI Summaries',
              icon: Sparkles,
              desc: 'Instant executive summaries of complex team metrics.',
            },
            {
              label: 'Deep Privacy',
              icon: ShieldCheck,
              desc: 'SOC2 compliant data masking at the edge.',
            },
          ].map((feat, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              className="p-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl hover:shadow-xl hover:shadow-blue-100/20 dark:hover:shadow-none transition-all"
            >
              <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-6">
                <feat.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">{feat.label}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {feat.desc}
              </p>
            </motion.div>
          ))}
        </section>
      </main>

      {/* Footer Branding */}
      <footer className="p-8 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-400">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            SprintStart Systems v2.4.0-Beta
          </span>
        </div>
        <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest">
          <a href="#" className="hover:text-blue-600 transition-colors">
            Documentation
          </a>
          <a href="#" className="hover:text-blue-600 transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-blue-600 transition-colors">
            Release Notes
          </a>
        </div>
      </footer>
    </div>
  );
}
