import React from 'react';
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  X,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  Lock,
} from 'lucide-react';
import {
  ScheduleDiff,
  ValidatedAiPlanResponse,
  ProposedAssignment,
  Technician,
  ServiceRequest,
} from '../types';

interface ReplanDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: string;
  diff: ScheduleDiff | null;
  proposedPlan: ValidatedAiPlanResponse | null;
  technicians: Technician[];
  requests: ServiceRequest[];
  onApproveRevised: (assignments: ProposedAssignment[]) => void;
  isApproving: boolean;
  contextData?: any;
}

export const ReplanDiffModal: React.FC<ReplanDiffModalProps> = ({
  isOpen,
  onClose,
  trigger,
  diff,
  proposedPlan,
  technicians,
  requests,
  onApproveRevised,
  isApproving,
  contextData,
}) => {
  if (!isOpen || !diff || !proposedPlan) return null;

  const techMap = new Map(technicians.map((t) => [t.id, t]));
  const reqMap = new Map(requests.map((r) => [r.id, r]));

  const summary = proposedPlan.validationSummary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 text-white shadow-lg shadow-amber-500/20">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Schedule Replanning Required</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {trigger === 'TECHNICIAN_CANCELLATION'
                    ? 'Technician Unavailable'
                    : trigger === 'EMERGENCY_REQUEST'
                    ? 'Emergency Work Order'
                    : 'Schedule Replan'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                AI re-optimized schedule to accommodate real-time disruption while preserving completed work.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diff Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-2">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-blue-400 text-xs font-medium">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>CHANGED</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{diff.summary.totalChanged}</div>
            <div className="text-[11px] text-slate-400">Reassigned or shifted</div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-amber-400 text-xs font-medium">
              <MinusCircle className="w-3.5 h-3.5" />
              <span>UNASSIGNED</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{diff.summary.totalUnassigned}</div>
            <div className="text-[11px] text-slate-400">Capacity/skill limits</div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-medium">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>NEW / ADDED</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{diff.summary.totalAdded}</div>
            <div className="text-[11px] text-slate-400">Emergency & new jobs</div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-purple-400 text-xs font-medium">
              <Lock className="w-3.5 h-3.5" />
              <span>PRESERVED</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{diff.summary.totalPreserved}</div>
            <div className="text-[11px] text-slate-400">Completed & untouched</div>
          </div>
        </div>

        {/* Diff Changes Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Detailed Schedule Comparison (Previous Schedule vs Proposed Version)
          </h3>

          <div className="space-y-2.5">
            {diff.changes.map((item, idx) => {
              const req = reqMap.get(item.requestId);
              const prevTech = item.previousTechnicianId ? techMap.get(item.previousTechnicianId) : null;
              const newTech = item.newTechnicianId ? techMap.get(item.newTechnicianId) : null;

              if (item.type === 'CHANGED') {
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-800/80 border border-blue-500/30 flex flex-col space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          CHANGED
                        </span>
                        <span className="font-semibold text-white text-sm">
                          {req ? req.title : item.requestId}
                        </span>
                        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                          {item.requestId}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60 flex-wrap gap-y-1">
                      <div className="flex items-center space-x-1.5 text-slate-400">
                        <span className="text-slate-500 line-through">
                          {prevTech?.name || item.previousTechnicianId} ({item.previousStartTime}–{item.previousEndTime})
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                        <span>{newTech?.name || item.newTechnicianId} ({item.newStartTime}–{item.newEndTime})</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      <span className="text-slate-500">Reason:</span> {item.reason}
                    </p>
                  </div>
                );
              }

              if (item.type === 'UNASSIGNED') {
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          UNASSIGNED
                        </span>
                        <span className="font-semibold text-white text-sm">
                          {req ? req.title : item.requestId}
                        </span>
                        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                          {item.requestId}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-amber-300/90 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 leading-relaxed">
                      <strong>Reason:</strong> {item.reason}
                    </p>
                  </div>
                );
              }

              if (item.type === 'ADDED') {
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          NEW / ADDED
                        </span>
                        <span className="font-semibold text-white text-sm">
                          {req ? req.title : item.requestId}
                        </span>
                        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                          {item.requestId}
                        </span>
                        {req?.isEmergency && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            CRITICAL EMERGENCY
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-emerald-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                      <span>Assigned to <strong>{newTech?.name}</strong> ({item.newStartTime}–{item.newEndTime})</span>
                    </div>

                    <p className="text-xs text-slate-400">
                      <span className="text-slate-500">Reason:</span> {item.reason}
                    </p>
                  </div>
                );
              }

              if (item.type === 'UNCHANGED' && item.isCompleted) {
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-900/50 border border-purple-500/20 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> COMPLETED (LOCKED)
                      </span>
                      <span className="font-medium text-slate-300">{req ? req.title : item.requestId}</span>
                    </div>
                    <span className="text-slate-500">
                      {prevTech?.name} ({item.previousStartTime}–{item.previousEndTime})
                    </span>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
          >
            Cancel / Dismiss
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onApproveRevised(proposedPlan.assignments)}
              disabled={isApproving || !summary.isValid}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isApproving ? 'Approving Revised Plan...' : 'Approve Revised Plan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
