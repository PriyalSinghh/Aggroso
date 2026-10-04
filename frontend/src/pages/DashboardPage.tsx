import React from 'react';
import {
  Sparkles,
  AlertOctagon,
  Wrench,
  Users,
  CalendarDays,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  UserX,
} from 'lucide-react';
import {
  Technician,
  ServiceRequest,
  ScheduleVersion,
  NotificationItem,
} from '../types';
import { MetricCard } from '../components/MetricCard';
import { TimelineView } from '../components/TimelineView';

interface DashboardPageProps {
  technicians: Technician[];
  requests: ServiceRequest[];
  currentSchedule: ScheduleVersion | null;
  onGeneratePlan: () => void;
  isGenerating: boolean;
  onOpenEmergencyModal: () => void;
  onSelectAssignment: (assignment: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  technicians,
  requests,
  currentSchedule,
  onGeneratePlan,
  isGenerating,
  onOpenEmergencyModal,
  onSelectAssignment,
}) => {
  const availableTechs = technicians.filter((t) => t.status === 'AVAILABLE');
  const cancelledTechs = technicians.filter((t) => t.status === 'CANCELLED');

  const assignedRequests = requests.filter((r) => r.status === 'ASSIGNED' || r.status === 'COMPLETED');
  const unassignedRequests = requests.filter((r) => r.status === 'UNASSIGNED');

  const activeAssignments = currentSchedule?.assignments || [];

  return (
    <div className="space-y-6">
      {/* Top Banner with Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Daily Field Service Dispatch & Replanning
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Live Operations
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              AI proposes candidate schedules with clear trade-offs, strictly validated by the backend deterministic constraint engine, and approved by human dispatchers.
            </p>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <button
              onClick={onOpenEmergencyModal}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 border border-rose-500/30 transition-all hover:scale-[1.02]"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Emergency Request</span>
            </button>

            <button
              onClick={onGeneratePlan}
              disabled={isGenerating}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Generating AI Proposal...' : 'Generate Dispatch Plan'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Service Requests"
          value={requests.length}
          subtitle={`${assignedRequests.length} scheduled / ${unassignedRequests.length} pending`}
          icon={Wrench}
          color="blue"
          badge={`${Math.round((assignedRequests.length / (requests.length || 1)) * 100)}% Assigned`}
        />
        <MetricCard
          title="Available Technicians"
          value={availableTechs.length}
          subtitle={`${cancelledTechs.length} currently unavailable`}
          icon={Users}
          color={cancelledTechs.length > 0 ? 'amber' : 'emerald'}
          badge={`${availableTechs.length}/${technicians.length} Active`}
        />
        <MetricCard
          title="Current Schedule"
          value={currentSchedule ? `Version ${currentSchedule.versionNumber}` : 'Draft'}
          subtitle={currentSchedule ? `Trigger: ${currentSchedule.trigger}` : 'No active version'}
          icon={CalendarDays}
          color="purple"
          badge={currentSchedule?.status || 'NONE'}
        />
        <MetricCard
          title="Unassigned Backlog"
          value={unassignedRequests.length}
          subtitle={unassignedRequests.length > 0 ? 'Requires attention or constraints adjustment' : 'Optimal capacity'}
          icon={unassignedRequests.length > 0 ? AlertTriangle : CheckCircle2}
          color={unassignedRequests.length > 0 ? 'amber' : 'emerald'}
          badge={unassignedRequests.length === 0 ? 'Clean' : 'Needs Review'}
        />
      </div>

      {/* Operational Alerts if any */}
      {(cancelledTechs.length > 0 || unassignedRequests.length > 0) && (
        <div className="space-y-3">
          {cancelledTechs.map((tech) => (
            <div
              key={tech.id}
              className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <UserX className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-white">
                    Technician {tech.name} ({tech.id}) is CANCELLED
                  </span>
                  <p className="text-rose-300/80 text-[11px] mt-0.5">
                    Region: {tech.region} | Skills: {tech.skills}. Scheduled jobs have been identified for replanning.
                  </p>
                </div>
              </div>
            </div>
          ))}

          {unassignedRequests.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-white">
                    {unassignedRequests.length} Service Ticket(s) Currently Unassigned
                  </span>
                  <p className="text-amber-300/80 text-[11px] mt-0.5">
                    Unassigned requests are kept pending with verified constraint reasons rather than forcing invalid assignments.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Interactive Timeline */}
      <TimelineView
        technicians={technicians}
        assignments={activeAssignments}
        requests={requests}
        onSelectAssignment={onSelectAssignment}
        onGeneratePlan={onGeneratePlan}
        isGenerating={isGenerating}
      />
    </div>
  );
};
