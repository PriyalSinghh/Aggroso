import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Wrench,
  ChevronRight,
  Info,
  X,
  Edit2,
  ArrowRight,
} from 'lucide-react';
import {
  ValidatedAiPlanResponse,
  ProposedAssignment,
  Technician,
  ServiceRequest,
} from '../types';

interface AiProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: ValidatedAiPlanResponse | null;
  technicians: Technician[];
  requests: ServiceRequest[];
  onApprove: (assignments: ProposedAssignment[]) => void;
  isApproving: boolean;
  triggerName?: string;
}

export const AiProposalModal: React.FC<AiProposalModalProps> = ({
  isOpen,
  onClose,
  proposal,
  technicians,
  requests,
  onApprove,
  isApproving,
  triggerName = 'INITIAL_PLAN',
}) => {
  if (!isOpen || !proposal) return null;

  const [activeTab, setActiveTab] = useState<'assignments' | 'unassigned' | 'tradeoffs'>('assignments');
  const [editingAssignments, setEditingAssignments] = useState<ProposedAssignment[]>(
    proposal.assignments
  );
  const [selectedAssignmentIdx, setSelectedAssignmentIdx] = useState<number | null>(null);

  const techMap = new Map(technicians.map((t) => [t.id, t]));
  const reqMap = new Map(requests.map((r) => [r.id, r]));

  const summary = proposal.validationSummary;

  const handleUpdateAssignment = (index: number, field: keyof ProposedAssignment, value: any) => {
    const updated = [...editingAssignments];
    updated[index] = { ...updated[index], [field]: value, source: 'MANUAL' };
    setEditingAssignments(updated);
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">AI Dispatch Proposal</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {triggerName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review proposed schedule allocations and deterministic validation results before approval.
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

        {/* System Principle Banner */}
        <div className="bg-slate-800/60 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-300">
            <span className="text-blue-400 font-semibold">1. AI PROPOSES</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 2. DETERMINISTIC VALIDATION
            </span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="text-amber-400 font-semibold">3. HUMAN APPROVAL</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="text-purple-400 font-semibold">4. CONFIRMED SCHEDULE</span>
          </div>

          <div className="flex items-center space-x-2">
            {summary.isValid ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                All {summary.validCount} Pass Validation
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                {summary.invalidCount} Violations Found
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'assignments'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Proposed Assignments</span>
            <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px]">
              {editingAssignments.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('unassigned')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'unassigned'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Unassigned Requests</span>
            <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px]">
              {proposal.unassignedRequests.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('tradeoffs')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'tradeoffs'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Trade-offs & Reasoning</span>
            <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px]">
              {proposal.tradeoffs.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'assignments' && (
            <div className="space-y-3">
              {editingAssignments.map((assignment, idx) => {
                const req = reqMap.get(assignment.requestId);
                const tech = techMap.get(assignment.technicianId);
                const isValid = assignment.isValid !== false;
                const violations = assignment.violations || [];

                return (
                  <div
                    key={`${assignment.requestId}-${idx}`}
                    className={`p-4 rounded-xl border transition-all ${
                      isValid
                        ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        : 'bg-rose-950/20 border-rose-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div
                          className={`mt-0.5 p-1.5 rounded-lg ${
                            isValid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {isValid ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-semibold text-white text-sm">
                              {req ? req.title : assignment.requestId}
                            </span>
                            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                              {assignment.requestId}
                            </span>
                            {req && (
                              <span
                                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getPriorityColor(
                                  req.priority
                                )}`}
                              >
                                {req.priority}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              • Skill: <strong className="text-slate-200">{req?.requiredSkill}</strong> • Region: <strong className="text-slate-200">{req?.region}</strong>
                            </span>
                          </div>

                          {/* Allocation Details */}
                          <div className="mt-2 flex items-center space-x-4 text-xs text-slate-300">
                            <div className="flex items-center space-x-1.5">
                              <User className="w-3.5 h-3.5 text-blue-400" />
                              <span>Technician: <strong className="text-white">{tech?.name || assignment.technicianId}</strong> ({assignment.technicianId})</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Time: <strong className="text-white">{assignment.startTime} – {assignment.endTime}</strong></span>
                            </div>
                          </div>

                          {/* Reason */}
                          {assignment.reason && (
                            <p className="mt-2 text-xs text-slate-400 bg-slate-800/40 p-2 rounded-lg border border-slate-800/60 leading-relaxed">
                              <span className="text-slate-500 font-medium">AI Rationale:</span> {assignment.reason}
                            </p>
                          )}

                          {/* Validation Violations if any */}
                          {violations.length > 0 && (
                            <div className="mt-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                              <div className="font-semibold flex items-center gap-1 text-rose-400">
                                <AlertTriangle className="w-3.5 h-3.5" /> Backend Deterministic Constraint Violations:
                              </div>
                              {violations.map((v, vIdx) => (
                                <div key={vIdx} className="ml-4 list-disc text-rose-300">
                                  • [{v.code}] {v.message}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'unassigned' && (
            <div className="space-y-3">
              {proposal.unassignedRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  All service requests were successfully scheduled!
                </div>
              ) : (
                proposal.unassignedRequests.map((unassigned) => {
                  const req = reqMap.get(unassigned.requestId);
                  return (
                    <div
                      key={unassigned.requestId}
                      className="p-4 rounded-xl bg-slate-900/80 border border-amber-900/40 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white text-sm">
                            {req ? req.title : unassigned.requestId}
                          </span>
                          <span className="font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {unassigned.requestId}
                          </span>
                          {req && (
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getPriorityColor(
                                req.priority
                              )}`}
                            >
                              {req.priority}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400">
                          {req?.region} | Required: {req?.requiredSkill}
                        </span>
                      </div>
                      <p className="text-amber-300/90 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                        <strong>Constraint Explanation:</strong> {unassigned.reason}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'tradeoffs' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-sm">
                  <Info className="w-4 h-4 text-blue-400" /> Dispatch Trade-offs & Optimization Strategy
                </h4>
                {proposal.tradeoffs.length > 0 ? (
                  <ul className="space-y-1.5 text-slate-300 ml-4 list-disc">
                    {proposal.tradeoffs.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">No major trade-offs were required for this schedule.</p>
                )}
              </div>

              {proposal.questions && proposal.questions.length > 0 && (
                <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 space-y-2">
                  <h4 className="font-semibold text-blue-300 text-sm">Questions for Dispatcher</h4>
                  <ul className="space-y-1 text-slate-300 ml-4 list-disc">
                    {proposal.questions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
          >
            Reject Proposal
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onApprove(editingAssignments)}
              disabled={isApproving || !summary.isValid}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isApproving ? 'Confirming & Approving...' : 'Approve & Confirm Schedule'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
