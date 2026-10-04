import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Clock,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Assignment, Technician, ServiceRequest, Violation } from '../types';
import { api } from '../services/api';

interface AssignmentEditDrawerProps {
  assignment: Assignment | null;
  technicians: Technician[];
  requests: ServiceRequest[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const AssignmentEditDrawer: React.FC<AssignmentEditDrawerProps> = ({
  assignment,
  technicians,
  requests,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen || !assignment) return null;

  const req = requests.find((r) => r.id === assignment.requestId) || assignment.serviceRequest;

  const [selectedTechId, setSelectedTechId] = useState(assignment.technicianId);
  const [startTime, setStartTime] = useState(assignment.startTime);
  const [endTime, setEndTime] = useState(assignment.endTime);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);

  useEffect(() => {
    if (assignment) {
      setSelectedTechId(assignment.technicianId);
      setStartTime(assignment.startTime);
      setEndTime(assignment.endTime);
      setReason('');
      setErrorMsg(null);
      setViolations([]);
    }
  }, [assignment]);

  const isCompleted = assignment.status === 'COMPLETED';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompleted) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setViolations([]);

    try {
      await api.updateAssignment(assignment.id, {
        technicianId: selectedTechId,
        startTime,
        endTime,
        reason: reason || 'Manual dispatcher override',
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update assignment');
      if (err.violations) {
        setViolations(err.violations);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkCompleted = async () => {
    setIsCompleting(true);
    setErrorMsg(null);
    try {
      await api.completeAssignment(assignment.id);
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete assignment');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">Assignment Details</h3>
                {isCompleted && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> COMPLETED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Job #{assignment.requestId}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Service Request Info Box */}
            {req && (
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">{req.title}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {req.priority}
                  </span>
                </div>
                {req.description && <p className="text-xs text-slate-400">{req.description}</p>}
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-300 border-t border-slate-700/40">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Required Skill:</span>
                    <strong className="text-slate-200">{req.requiredSkill}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Region:</span>
                    <strong className="text-slate-200">{req.region}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Duration:</span>
                    <strong className="text-slate-200">{req.estimatedDurationMinutes} mins</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Preferred Window:</span>
                    <strong className="text-slate-200">{req.preferredStartTime} – {req.preferredEndTime}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Error or Violation Banner */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs space-y-1.5">
                <div className="flex items-center space-x-1.5 font-semibold text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Validation Error: {errorMsg}</span>
                </div>
                {violations.length > 0 && (
                  <ul className="ml-4 list-disc space-y-1 text-rose-300/90 text-[11px]">
                    {violations.map((v, idx) => (
                      <li key={idx}>[{v.code}] {v.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Edit Form */}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Assigned Technician
                </label>
                <select
                  value={selectedTechId}
                  disabled={isCompleted}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.status === 'CANCELLED'}>
                      {t.name} ({t.region} | {t.skills}) {t.status === 'CANCELLED' ? '[CANCELLED]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    disabled={isCompleted}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    disabled={isCompleted}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Override Reason
                </label>
                <textarea
                  value={reason}
                  disabled={isCompleted}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for manual adjustment (recorded in audit log)..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              {!isCompleted && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Validating & Saving...' : 'Save Manual Override'}
                </button>
              )}
            </form>

            {/* Complete Job Action */}
            {!isCompleted && (
              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={handleMarkCompleted}
                  disabled={isCompleting}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isCompleting ? 'Completing...' : 'Mark Job as Completed (Lock)'}</span>
                </button>
                <p className="text-[10px] text-slate-500 text-center mt-1.5">
                  Completed jobs cannot be moved during future AI replanning.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
