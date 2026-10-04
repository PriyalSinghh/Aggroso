import React, { useState } from 'react';
import {
  ScheduleVersion,
  Technician,
  ServiceRequest,
  Assignment,
} from '../types';
import { TimelineView } from '../components/TimelineView';
import {
  CalendarDays,
  History,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Filter,
} from 'lucide-react';

interface SchedulePageProps {
  technicians: Technician[];
  requests: ServiceRequest[];
  scheduleVersions: ScheduleVersion[];
  currentSchedule: ScheduleVersion | null;
  onSelectAssignment: (assignment: Assignment) => void;
  onGeneratePlan: () => void;
  isGenerating: boolean;
}

export const SchedulePage: React.FC<SchedulePageProps> = ({
  technicians,
  requests,
  scheduleVersions,
  currentSchedule,
  onSelectAssignment,
  onGeneratePlan,
  isGenerating,
}) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    currentSchedule?.id || (scheduleVersions[0]?.id ?? '')
  );
  const [regionFilter, setRegionFilter] = useState<string>('ALL');

  const selectedVersion =
    scheduleVersions.find((v) => v.id === selectedVersionId) || currentSchedule;

  const filteredTechnicians =
    regionFilter === 'ALL'
      ? technicians
      : technicians.filter((t) => t.region === regionFilter);

  const activeAssignments = selectedVersion?.assignments || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Version Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-400" /> Schedule Management & Version History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Switch between historical schedule versions or plan future iterations.
          </p>
        </div>

        {/* Version Selector & Filter */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {/* Version Selector Dropdown */}
          <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <Layers className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Version:</span>
            <select
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              {scheduleVersions.map((ver) => (
                <option key={ver.id} value={ver.id} className="bg-slate-900 text-white">
                  v{ver.versionNumber} ({ver.status} - {ver.trigger})
                </option>
              ))}
            </select>
          </div>

          {/* Region Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Regions</option>
              <option value="North" className="bg-slate-900">North</option>
              <option value="South" className="bg-slate-900">South</option>
              <option value="East" className="bg-slate-900">East</option>
              <option value="West" className="bg-slate-900">West</option>
            </select>
          </div>

          <button
            onClick={onGeneratePlan}
            disabled={isGenerating}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Plan</span>
          </button>
        </div>
      </div>

      {/* Version Metadata Card if available */}
      {selectedVersion && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                selectedVersion.status === 'APPROVED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {selectedVersion.status}
            </span>
            <span className="text-slate-300 font-medium">
              Schedule Version {selectedVersion.versionNumber}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Trigger: <strong>{selectedVersion.trigger}</strong></span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Approved by: <strong>{selectedVersion.createdBy}</strong></span>
          </div>

          <div className="text-slate-400 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Created {new Date(selectedVersion.createdAt).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Timeline View */}
      <TimelineView
        technicians={filteredTechnicians}
        assignments={activeAssignments}
        requests={requests}
        onSelectAssignment={onSelectAssignment}
        onGeneratePlan={onGeneratePlan}
        isGenerating={isGenerating}
      />
    </div>
  );
};
