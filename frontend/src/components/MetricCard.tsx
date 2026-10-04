import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
  badge?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  badge,
}) => {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/5',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/5',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-purple-500/5',
  };

  const iconBgMap = {
    blue: 'bg-blue-500/20 text-blue-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    rose: 'bg-rose-500/20 text-rose-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg ${iconBgMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${colorMap[color]}`}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
};
