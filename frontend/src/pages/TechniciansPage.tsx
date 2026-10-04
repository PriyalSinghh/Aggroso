import React, { useState } from 'react';
import { Technician } from '../types';
import {
  Users,
  UserX,
  UserCheck,
  Clock,
  MapPin,
  Wrench,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

interface TechniciansPageProps {
  technicians: Technician[];
  onCancelTechnician: (techId: string) => void;
  onRestoreTechnician: (techId: string) => void;
  isCancelling: boolean;
}

export const TechniciansPage: React.FC<TechniciansPageProps> = ({
  technicians,
  onCancelTechnician,
  onRestoreTechnician,
  isCancelling,
}) => {
  const [confirmCancelTech, setConfirmCancelTech] = useState<Technician | null>(null);

  const handleConfirmCancel = () => {
    if (confirmCancelTech) {
      onCancelTechnician(confirmCancelTech.id);
      setConfirmCancelTech(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" /> Technician Roster & Capacity
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor technician certifications, regions, operating windows, and daily workload limits.
          </p>
        </div>
      </div>

      {/* Technician Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {technicians.map((tech) => {
          const isCancelled = tech.status === 'CANCELLED';
          const workload = tech.currentWorkloadMinutes || 0;
          const maxWorkload = tech.maxWorkloadMinutes || 480;
          const workloadPercent = Math.min(100, Math.round((workload / maxWorkload) * 100));

          return (
            <div
              key={tech.id}
              className={`rounded-2xl border p-5 transition-all relative overflow-hidden flex flex-col justify-between ${
                isCancelled
                  ? 'bg-rose-950/20 border-rose-900/60 opacity-80'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-xl'
              }`}
            >
              <div>
                {/* Card Top */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-md ${
                        isCancelled
                          ? 'bg-rose-900/60 text-rose-300 border border-rose-500/40'
                          : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                      }`}
                    >
                      {tech.id}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{tech.name}</h3>
                      <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" /> {tech.region} Region
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      isCancelled
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {tech.status}
                  </span>
                </div>

                {/* Skills */}
                <div className="mt-4 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Certified Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {tech.skills.split(',').map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium"
                      >
                        {s.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Availability & Workload Details */}
                <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> Operating Window:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">
                      {tech.availabilityStart} – {tech.availabilityEnd}
                    </span>
                  </div>

                  {/* Workload Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Scheduled Workload:</span>
                      <span className="font-semibold text-white">
                        {workload} / {maxWorkload} mins ({workloadPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        style={{ width: `${workloadPercent}%` }}
                        className={`h-full rounded-full transition-all ${
                          workloadPercent > 90
                            ? 'bg-rose-500'
                            : workloadPercent > 60
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3 border-t border-slate-800">
                {isCancelled ? (
                  <button
                    onClick={() => onRestoreTechnician(tech.id)}
                    className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Restore to Available</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmCancelTech(tech)}
                    disabled={isCancelling}
                    className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                    <span>Simulate Technician Cancellation</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Technician Cancellation Confirmation Modal */}
      {confirmCancelTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-900/60 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Cancellation</h3>
                <p className="text-xs text-slate-400">Technician: {confirmCancelTech.name} ({confirmCancelTech.id})</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-rose-950/20 p-3 rounded-xl border border-rose-900/40">
              Marking <strong>{confirmCancelTech.name}</strong> as unavailable will immediately trigger the <strong>Schedule Replanning Engine</strong>. The AI Agent will propose reallocating orphaned work orders to qualified alternative technicians without affecting completed tasks.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setConfirmCancelTech(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700"
              >
                Dismiss
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20"
              >
                {isCancelling ? 'Cancelling & Replanning...' : 'Confirm & Replan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
