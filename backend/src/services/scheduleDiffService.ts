import { ProposedAssignment, ProposedUnassignedRequest, ScheduleDiff, ScheduleDiffItem } from '../types/index.js';
import { Assignment, ServiceRequest, Technician } from '@prisma/client';

export class ScheduleDiffService {
  static computeDiff(params: {
    previousAssignments: Assignment[];
    newAssignments: ProposedAssignment[];
    unassignedRequests: ProposedUnassignedRequest[];
    requests: ServiceRequest[];
    technicians: Technician[];
    tradeoffs?: string[];
  }): ScheduleDiff {
    const {
      previousAssignments,
      newAssignments,
      unassignedRequests,
      requests,
      technicians,
      tradeoffs = [],
    } = params;

    const reqMap = new Map(requests.map((r) => [r.id, r]));
    const techMap = new Map(technicians.map((t) => [t.id, t]));
    const prevMap = new Map(previousAssignments.map((a) => [a.requestId, a]));
    const newMap = new Map(newAssignments.map((a) => [a.requestId, a]));

    const changes: ScheduleDiffItem[] = [];

    // Check all previous assignments
    for (const prev of previousAssignments) {
      const req = reqMap.get(prev.requestId);
      const reqTitle = req ? req.title : prev.requestId;
      const next = newMap.get(prev.requestId);

      if (!next) {
        // Was assigned, now unassigned / removed
        const unassignedReason =
          unassignedRequests.find((u) => u.requestId === prev.requestId)?.reason ||
          'Technician capacity or constraint conflict in revised plan.';

        changes.push({
          requestId: prev.requestId,
          requestTitle: reqTitle,
          type: 'UNASSIGNED',
          previousTechnicianId: prev.technicianId,
          previousStartTime: prev.startTime,
          previousEndTime: prev.endTime,
          reason: unassignedReason,
          isCompleted: prev.status === 'COMPLETED',
        });
      } else {
        const isTechChanged = prev.technicianId !== next.technicianId;
        const isTimeChanged = prev.startTime !== next.startTime || prev.endTime !== next.endTime;

        if (isTechChanged || isTimeChanged) {
          const prevTech = techMap.get(prev.technicianId)?.name || prev.technicianId;
          const newTech = techMap.get(next.technicianId)?.name || next.technicianId;

          let diffReason = next.reason || '';
          if (isTechChanged && isTimeChanged) {
            diffReason = `Reassigned from ${prevTech} (${prev.startTime}-${prev.endTime}) to ${newTech} (${next.startTime}-${next.endTime}).`;
          } else if (isTechChanged) {
            diffReason = `Technician changed from ${prevTech} to ${newTech}.`;
          } else if (isTimeChanged) {
            diffReason = `Schedule time adjusted from ${prev.startTime}-${prev.endTime} to ${next.startTime}-${next.endTime}.`;
          }

          changes.push({
            requestId: prev.requestId,
            requestTitle: reqTitle,
            type: 'CHANGED',
            previousTechnicianId: prev.technicianId,
            newTechnicianId: next.technicianId,
            previousStartTime: prev.startTime,
            newStartTime: next.startTime,
            previousEndTime: prev.endTime,
            newEndTime: next.endTime,
            reason: diffReason,
            isCompleted: prev.status === 'COMPLETED',
          });
        } else {
          changes.push({
            requestId: prev.requestId,
            requestTitle: reqTitle,
            type: 'UNCHANGED',
            previousTechnicianId: prev.technicianId,
            newTechnicianId: next.technicianId,
            previousStartTime: prev.startTime,
            newStartTime: next.startTime,
            previousEndTime: prev.endTime,
            newEndTime: next.endTime,
            reason: 'Maintained current schedule without changes.',
            isCompleted: prev.status === 'COMPLETED',
          });
        }
      }
    }

    // Check newly added assignments (not in previous)
    for (const next of newAssignments) {
      if (!prevMap.has(next.requestId)) {
        const req = reqMap.get(next.requestId);
        const reqTitle = req ? req.title : next.requestId;
        const newTech = techMap.get(next.technicianId)?.name || next.technicianId;

        changes.push({
          requestId: next.requestId,
          requestTitle: reqTitle,
          type: 'ADDED',
          newTechnicianId: next.technicianId,
          newStartTime: next.startTime,
          newEndTime: next.endTime,
          reason: next.reason || `Newly scheduled to ${newTech} (${next.startTime}-${next.endTime}).`,
          isCompleted: false,
        });
      }
    }


    const totalChanged = changes.filter((c) => c.type === 'CHANGED').length;
    const totalUnassigned = changes.filter((c) => c.type === 'UNASSIGNED').length;
    const totalAdded = changes.filter((c) => c.type === 'ADDED').length;
    const totalPreserved = changes.filter((c) => c.type === 'UNCHANGED').length;

    return {
      summary: {
        totalChanged,
        totalUnassigned,
        totalAdded,
        totalPreserved,
      },
      changes,
      tradeoffs,
    };
  }
}
