import React, { useState } from 'react';
import { ServiceRequest } from '../types';
import {
  Wrench,
  AlertOctagon,
  Search,
  Filter,
  Clock,
  User,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface RequestsPageProps {
  requests: ServiceRequest[];
  onOpenEmergencyModal: () => void;
}

export const RequestsPage: React.FC<RequestsPageProps> = ({
  requests,
  onOpenEmergencyModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const filtered = requests.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requiredSkill.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.region.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || r.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityBadge = (priority: string) => {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'COMPLETED':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'CANCELLED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-400" /> Service Requests & Work Orders
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Active service ticket backlog for the current operating shift.
          </p>
        </div>

        <button
          onClick={onOpenEmergencyModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all self-start sm:self-auto"
        >
          <AlertOctagon className="w-4 h-4" />
          <span>Add Emergency Work Order</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID, title, skill, or region..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNASSIGNED">Unassigned</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 border-b border-slate-700/80 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Request ID</th>
                <th className="py-3 px-4 font-semibold">Title & Description</th>
                <th className="py-3 px-4 font-semibold">Region</th>
                <th className="py-3 px-4 font-semibold">Required Skill</th>
                <th className="py-3 px-4 font-semibold">Priority</th>
                <th className="py-3 px-4 font-semibold">Duration</th>
                <th className="py-3 px-4 font-semibold">Preferred Window</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Assigned Tech</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                    <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {req.id}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="font-semibold text-white truncate">{req.title}</div>
                    {req.description && (
                      <div className="text-slate-400 text-[11px] truncate mt-0.5">
                        {req.description}
                      </div>
                    )}
                    {req.isEmergency && (
                      <span className="inline-block mt-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                        EMERGENCY TICKET
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {req.region}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-200">
                    {req.requiredSkill}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityBadge(
                        req.priority
                      )}`}
                    >
                      {req.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">
                    {req.estimatedDurationMinutes} mins
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    {req.preferredStartTime} – {req.preferredEndTime}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(
                        req.status
                      )}`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {req.currentAssignment ? (
                      <div className="space-y-0.5">
                        <span className="font-semibold text-blue-400">
                          {req.currentAssignment.technicianName}
                        </span>
                        <div className="text-[10px] font-mono text-slate-400">
                          {req.currentAssignment.startTime}–{req.currentAssignment.endTime}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
