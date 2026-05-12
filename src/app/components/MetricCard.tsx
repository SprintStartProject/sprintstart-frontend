import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: LucideIcon;
}

export function MetricCard({
  title,
  value,
  change,
  trend = 'neutral',
  icon: Icon,
}: MetricCardProps) {
  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400',
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-2">{value}</p>
          {change && <p className={`text-sm mt-2 ${trendColors[trend]}`}>{change}</p>}
        </div>
        {Icon && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        )}
      </div>
    </div>
  );
}
