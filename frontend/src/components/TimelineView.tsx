import React from 'react';
import {
  Technician,
  Assignment,
  ServiceRequest,
} from '../types';
import {
  Clock,
  User,
  AlertTriangle,
  Lock,
  Sparkles,
  CheckCircle2,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface TimelineViewProps {
  technicians: Technician[];
  assignments: Assignment[];
  requests: ServiceRequest[];
  onSelectAssignment: (assignment: Assignment) => void;
  onGeneratePlan: () => void;
  isGenerating: boolean;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  technicians,
  assignments,
  requests,
  onSelectAssignment,
  onGeneratePlan,
  isGenerating,
}) => {
  const startHour = 8; // 08:00
  const endHour = 18;  // 18:00
  const totalMinutes = (endHour - startHour) * 60; // 600 minutes

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const reqMap = new Map(requests.map((r) => [r.id, r]));

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const getPriorityStyle = (priority?: string, status?: string) => {
    if (status === 'COMPLETED') {
      return 'bg-purple-900/60 border-purple-500/70 text-purple-100 hover:bg-purple-900/80 shadow-purple-500/20';
    }
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-900/70 border-rose-500 text-rose-100 hover:bg-rose-900/90 shadow-rose-500/20';
      case 'HIGH':
        return 'bg-amber-900/70 border-amber-500 text-amber-100 hover:bg-amber-900/90 shadow-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-900/70 border-blue-500 text-blue-100 hover:bg-blue-900/90 shadow-blue-500/20';
      default:
        return 'bg-emerald-900/70 border-emerald-500 text-emerald-100 hover:bg-emerald-900/90 shadow-emerald-500/20';
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Header bar */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-900/90">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" /> Dispatch Timeline View
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time technician Gantt schedule for today (08:00 – 18:00). Click any job to inspect or adjust.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[11px] text-slate-300 flex-wrap gap-y-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-rose-500/80 border border-rose-400"></span>
            <span>Critical</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/80 border border-amber-400"></span>
            <span>High</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-blue-500/80 border border-blue-400"></span>
            <span>Medium</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500/80 border border-emerald-400"></span>
            <span>Low</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-purple-600 border border-purple-400 flex items-center justify-center">
              <Lock className="w-2 h-2 text-white" />
            </span>
            <span>Completed</span>
          </div>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="py-16 px-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/10">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-white">No Confirmed Schedule Active</h3>
            <p className="text-xs text-slate-400 mt-1">
              Initialize the field service schedule by generating an AI-optimized dispatch proposal.
            </p>
          </div>
          <button
            onClick={onGeneratePlan}
            disabled={isGenerating}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Analyzing & Planning...' : 'Generate Dispatch Plan with AI'}</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[850px]">
            {/* Timeline Time Header */}
            <div className="flex border-b border-slate-800 bg-slate-900/80">
              <div className="w-64 p-3 border-r border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                Technician & Region
              </div>
              <div className="flex-1 relative flex">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 text-center py-2 text-[11px] font-mono font-medium text-slate-400 border-r border-slate-800/60 last:border-r-0"
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Technician Rows */}
            <div className="divide-y divide-slate-800/80">
              {technicians.map((tech) => {
                const techAssignments = assignments.filter((a) => a.technicianId === tech.id);
                const isCancelled = tech.status === 'CANCELLED';

                return (
                  <div
                    key={tech.id}
                    className={`flex items-stretch min-h-[85px] transition-colors ${
                      isCancelled ? 'bg-rose-950/10 opacity-70' : 'hover:bg-slate-800/20'
                    }`}
                  >
                    {/* Tech details column */}
                    <div className="w-64 p-3 border-r border-slate-800 flex flex-col justify-center">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm text-white">{tech.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {tech.id}
                          </span>
                        </div>
                        {isCancelled ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            CANCELLED
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            {tech.region}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center space-x-1.5 text-[11px] text-slate-400">
                        <span>Skills:</span>
                        <span className="text-slate-300 font-medium truncate max-w-[150px]">
                          {tech.skills}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Avail: {tech.availabilityStart}–{tech.availabilityEnd}</span>
                        <span>{techAssignments.length} job(s)</span>
                      </div>
                    </div>

                    {/* Timeline canvas */}
                    <div className="flex-1 relative bg-slate-950/40 p-1 flex items-center">
                      {/* Grid background lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {hours.map((hour) => (
                          <div
                            key={hour}
                            className="flex-1 border-r border-slate-800/40 last:border-r-0 h-full"
                          />
                        ))}
                      </div>

                      {/* Assignment Blocks */}
                      {techAssignments.map((assignment) => {
                        const req = reqMap.get(assignment.requestId) || assignment.serviceRequest;
                        const startMins = timeToMinutes(assignment.startTime);
                        const endMins = timeToMinutes(assignment.endTime);

                        const baseStart = startHour * 60;
                        const leftPercent = Math.max(0, ((startMins - baseStart) / totalMinutes) * 100);
                        const widthPercent = Math.min(
                          100 - leftPercent,
                          ((endMins - startMins) / totalMinutes) * 100
                        );

                        const isCompleted = assignment.status === 'COMPLETED';

                        return (
                          <div
                            key={assignment.id}
                            onClick={() => onSelectAssignment(assignment)}
                            style={{
                              left: `${leftPercent}%`,
                              width: `${Math.max(widthPercent, 5)}%`,
                            }}
                            className={`absolute top-2 bottom-2 rounded-xl border p-2 cursor-pointer shadow-md transition-all hover:scale-[1.02] hover:z-20 overflow-hidden flex flex-col justify-between ${getPriorityStyle(
                              req?.priority,
                              assignment.status
                            )}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center space-x-1 truncate">
                                {isCompleted && <Lock className="w-3 h-3 text-purple-300 flex-shrink-0" />}
                                {req?.isEmergency && (
                                  <AlertCircle className="w-3 h-3 text-rose-300 animate-pulse flex-shrink-0" />
                                )}
                                <span className="font-bold text-xs truncate">
                                  {assignment.requestId}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono opacity-80 whitespace-nowrap">
                                {assignment.startTime}–{assignment.endTime}
                              </span>
                            </div>

                            <p className="text-[11px] font-medium truncate opacity-90">
                              {req?.title || 'Service Task'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
