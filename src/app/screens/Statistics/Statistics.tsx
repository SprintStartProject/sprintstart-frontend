import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Users,
  BookOpen,
  Clock,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const DATA_GROWTH = [
  { name: 'Jan', docs: 400, views: 2400 },
  { name: 'Feb', docs: 600, views: 3200 },
  { name: 'Mar', docs: 800, views: 4800 },
  { name: 'Apr', docs: 1100, views: 5600 },
  { name: 'May', docs: 1400, views: 7200 },
  { name: 'Jun', docs: 1800, views: 9100 },
];

const DATA_ROLES = [
  { name: 'Engineering', value: 45, color: '#2563eb' },
  { name: 'Product', value: 25, color: '#7c3aed' },
  { name: 'Design', value: 20, color: '#db2777' },
  { name: 'HR/Ops', value: 10, color: '#059669' },
];

export default function Statistics() {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <header className="px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Organization Statistics
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Enterprise-wide onboarding and knowledge metrics
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 transition-all hover:bg-gray-50 dark:hover:bg-gray-700">
              <Calendar className="w-4 h-4" />
              Last 6 Months
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold transition-all hover:bg-blue-700 shadow-md shadow-blue-200 dark:shadow-none">
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Learners', value: '1,284', change: '+14.2%', trend: 'up', icon: Users },
            {
              label: 'Avg. Time to Prod',
              value: '18 Days',
              change: '-2.4 Days',
              trend: 'up',
              icon: Clock,
            },
            {
              label: 'Knowledge Utility',
              value: '92/100',
              change: '+5.1',
              trend: 'up',
              icon: TrendingUp,
            },
            { label: 'Active Docs', value: '4,102', change: '+320', trend: 'up', icon: BookOpen },
          ].map((kpi, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                  <kpi.icon className="w-5 h-5 text-blue-600" />
                </div>
                <div
                  className={`flex items-center gap-0.5 text-xs font-bold ${kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}
                >
                  {kpi.change}
                  {kpi.trend === 'up' ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                </div>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {kpi.label}
              </p>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-8 uppercase tracking-widest">
              Knowledge Ingestion vs. Views
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={DATA_GROWTH}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: 'none',
                      borderRadius: '12px',
                      color: '#fff',
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#2563eb"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorViews)"
                  />
                  <Area
                    type="monotone"
                    dataKey="docs"
                    stroke="#7c3aed"
                    strokeWidth={3}
                    fillOpacity={0}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-8 uppercase tracking-widest">
              Active Users by Department
            </h3>
            <div className="flex h-72 items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={DATA_ROLES}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {DATA_ROLES.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-4 pr-8">
                {DATA_ROLES.map((role) => (
                  <div key={role.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                      {role.name}
                    </span>
                    <span className="text-xs font-black text-gray-900 dark:text-white ml-auto">
                      {role.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">
              Weekly Engagement Trend
            </h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full text-[10px] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                New Users
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-full text-[10px] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                Returning
              </div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DATA_GROWTH}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="docs" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="views" fill="#7c3aed" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
