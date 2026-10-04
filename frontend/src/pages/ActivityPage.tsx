import React from 'react';
import { AuditLog } from '../types';
import {
  History,
  Clock,
  User,
  ShieldCheck,
  FileText,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

interface ActivityPageProps {
  logs: AuditLog[];
}

export const ActivityPage: React.FC<ActivityPageProps> = ({ logs }) => {
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'SCHEDULE_APPROVED':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'TECHNICIAN_CANCELLED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'EMERGENCY_REQUEST_CREATED':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'MANUAL_ASSIGNMENT_OVERRIDE':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'ASSIGNMENT_COMPLETED':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <History className="w-5 h-5 text-blue-400" /> System Activity & Audit Trail
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Immutable audit record of dispatch approvals, AI replans, manual overrides, and cancellations.
        </p>
      </div>

      {/* Audit Log Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No audit records found.
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-800 ml-4 space-y-6">
            {logs.map((log) => {
              let prevFormatted = null;
              let nextFormatted = null;

              if (log.previousValue) {
                try {
                  prevFormatted = JSON.stringify(JSON.parse(log.previousValue), null, 2);
                } catch (e) {
                  prevFormatted = log.previousValue;
                }
              }

              if (log.newValue) {
                try {
                  nextFormatted = JSON.stringify(JSON.parse(log.newValue), null, 2);
                } catch (e) {
                  nextFormatted = log.newValue;
                }
              }

              return (
                <div key={log.id} className="relative pl-6 group">
                  {/* Timeline dot */}
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-blue-500 group-hover:scale-110 transition-transform" />

                  <div className="bg-slate-850 bg-slate-800/40 border border-slate-800 hover:border-slate-700 p-4 rounded-xl space-y-2 transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          {log.entityType} ({log.entityId})
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 font-medium text-slate-300">
                          <User className="w-3 h-3 text-blue-400" /> {log.actor}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />{' '}
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {log.reason && (
                      <p className="text-xs text-slate-300 font-medium bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                        {log.reason}
                      </p>
                    )}

                    {/* Before & After Values Diffs if present */}
                    {(prevFormatted || nextFormatted) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
                        {prevFormatted && (
                          <div className="bg-rose-950/20 border border-rose-900/40 p-2 rounded-lg text-rose-300">
                            <span className="text-slate-500 block text-[10px] font-sans font-semibold mb-1">
                              Previous State:
                            </span>
                            <pre className="overflow-x-auto whitespace-pre-wrap">{prevFormatted}</pre>
                          </div>
                        )}
                        {nextFormatted && (
                          <div className="bg-emerald-950/20 border border-emerald-900/40 p-2 rounded-lg text-emerald-300">
                            <span className="text-slate-500 block text-[10px] font-sans font-semibold mb-1">
                              New State:
                            </span>
                            <pre className="overflow-x-auto whitespace-pre-wrap">{nextFormatted}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
