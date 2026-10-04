import {
  Technician,
  ServiceRequest,
  ScheduleVersion,
  Assignment,
  AuditLog,
  NotificationItem,
  ValidatedAiPlanResponse,
  ScheduleDiff,
  ProposedAssignment,
  ValidationResult,
  Violation,
  ProposedUnassignedRequest,
} from '../types';

export class TimeUtils {
  static parseTimeToMinutes(timeStr: string): number {
    if (!timeStr || !timeStr.includes(':')) return -1;
    const [hoursStr, minutesStr] = timeStr.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return -1;
    }
    return hours * 60 + minutes;
  }

  static minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  static doIntervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
    return startA < endB && startB < endA;
  }
}

export class ClientConstraintEngine {
  static validateSchedule(params: {
    proposedAssignments: ProposedAssignment[];
    technicians: Technician[];
    requests: ServiceRequest[];
    baseCompletedAssignments?: Assignment[];
  }): ValidationResult {
    const { proposedAssignments, technicians, requests, baseCompletedAssignments = [] } = params;
    const violations: Violation[] = [];

    const techMap = new Map<string, Technician>(technicians.map((t) => [t.id, t]));
    const reqMap = new Map<string, ServiceRequest>(requests.map((r) => [r.id, r]));

    // 1. Completed protection
    for (const completed of baseCompletedAssignments) {
      const match = proposedAssignments.find((p) => p.requestId === completed.requestId);
      if (!match) {
        violations.push({
          code: 'COMPLETED_ASSIGNMENT_MODIFIED',
          requestId: completed.requestId,
          message: `Completed assignment for request ${completed.requestId} was removed from the schedule.`,
        });
      } else if (
        match.technicianId !== completed.technicianId ||
        match.startTime !== completed.startTime ||
        match.endTime !== completed.endTime
      ) {
        violations.push({
          code: 'COMPLETED_ASSIGNMENT_MODIFIED',
          requestId: completed.requestId,
          technicianId: match.technicianId,
          message: `Completed assignment for request ${completed.requestId} cannot be moved or reallocated.`,
        });
      }
    }

    // 2. Validate individual assignments
    for (const assignment of proposedAssignments) {
      const tech = techMap.get(assignment.technicianId);
      const req = reqMap.get(assignment.requestId);

      if (!tech) {
        violations.push({
          code: 'UNKNOWN_ENTITY',
          requestId: assignment.requestId,
          technicianId: assignment.technicianId,
          message: `Technician with ID '${assignment.technicianId}' does not exist.`,
        });
        continue;
      }
      if (!req) {
        violations.push({
          code: 'UNKNOWN_ENTITY',
          requestId: assignment.requestId,
          technicianId: assignment.technicianId,
          message: `Service request with ID '${assignment.requestId}' does not exist.`,
        });
        continue;
      }

      const singleViolations = this.validateSingleAssignment({ assignment, technician: tech, request: req });
      violations.push(...singleViolations);
    }

    // 3. Double Booking & Max Workload
    const assignmentsByTech = new Map<string, ProposedAssignment[]>();
    for (const a of proposedAssignments) {
      if (!assignmentsByTech.has(a.technicianId)) {
        assignmentsByTech.set(a.technicianId, []);
      }
      assignmentsByTech.get(a.technicianId)!.push(a);
    }

    for (const [techId, techAssignments] of assignmentsByTech.entries()) {
      const tech = techMap.get(techId);
      if (!tech) continue;

      for (let i = 0; i < techAssignments.length; i++) {
        for (let j = i + 1; j < techAssignments.length; j++) {
          const a1 = techAssignments[i];
          const a2 = techAssignments[j];
          const s1 = TimeUtils.parseTimeToMinutes(a1.startTime);
          const e1 = TimeUtils.parseTimeToMinutes(a1.endTime);
          const s2 = TimeUtils.parseTimeToMinutes(a2.startTime);
          const e2 = TimeUtils.parseTimeToMinutes(a2.endTime);

          if (s1 !== -1 && e1 !== -1 && s2 !== -1 && e2 !== -1 && TimeUtils.doIntervalsOverlap(s1, e1, s2, e2)) {
            violations.push({
              code: 'DOUBLE_BOOKING',
              technicianId: techId,
              requestId: `${a1.requestId} & ${a2.requestId}`,
              message: `Double booking for technician ${tech.name} (${techId}): Request ${a1.requestId} (${a1.startTime}-${a1.endTime}) overlaps with Request ${a2.requestId} (${a2.startTime}-${a2.endTime}).`,
            });
          }
        }
      }

      const totalMins = techAssignments.reduce((sum, a) => {
        const s = TimeUtils.parseTimeToMinutes(a.startTime);
        const e = TimeUtils.parseTimeToMinutes(a.endTime);
        return sum + (e > s ? e - s : 0);
      }, 0);

      if (totalMins > tech.maxWorkloadMinutes) {
        violations.push({
          code: 'WORKLOAD_EXCEEDED',
          technicianId: techId,
          message: `Technician ${tech.name} (${techId}) exceeds maximum daily workload: assigned ${totalMins} mins (Max: ${tech.maxWorkloadMinutes} mins).`,
        });
      }
    }

    return { valid: violations.length === 0, violations };
  }

  static validateSingleAssignment(params: {
    assignment: ProposedAssignment;
    technician: Technician;
    request: ServiceRequest;
  }): Violation[] {
    const { assignment, technician, request } = params;
    const violations: Violation[] = [];

    const startMins = TimeUtils.parseTimeToMinutes(assignment.startTime);
    const endMins = TimeUtils.parseTimeToMinutes(assignment.endTime);

    if (startMins === -1 || endMins === -1 || endMins <= startMins) {
      violations.push({
        code: 'INVALID_TIME_FORMAT',
        requestId: request.id,
        technicianId: technician.id,
        message: `Invalid time range: ${assignment.startTime} to ${assignment.endTime}.`,
      });
      return violations;
    }

    if (technician.status === 'CANCELLED') {
      violations.push({
        code: 'TECHNICIAN_CANCELLED',
        requestId: request.id,
        technicianId: technician.id,
        message: `Cannot assign request to technician ${technician.name} (${technician.id}) because they are CANCELLED.`,
      });
    }

    if (request.status === 'CANCELLED') {
      violations.push({
        code: 'REQUEST_CANCELLED',
        requestId: request.id,
        technicianId: technician.id,
        message: `Cannot assign request ${request.id} because it is CANCELLED.`,
      });
    }

    const techSkills = technician.skills.split(',').map((s) => s.trim().toLowerCase());
    if (!techSkills.includes(request.requiredSkill.trim().toLowerCase())) {
      violations.push({
        code: 'SKILL_MISMATCH',
        requestId: request.id,
        technicianId: technician.id,
        message: `Technician ${technician.name} does not have the required skill '${request.requiredSkill}' (Has: ${technician.skills}).`,
      });
    }

    if (technician.region.trim().toLowerCase() !== request.region.trim().toLowerCase()) {
      violations.push({
        code: 'REGION_MISMATCH',
        requestId: request.id,
        technicianId: technician.id,
        message: `Region mismatch: Technician ${technician.name} is in '${technician.region}', but Request ${request.id} is in '${request.region}'.`,
      });
    }

    const techAvailStart = TimeUtils.parseTimeToMinutes(technician.availabilityStart);
    const techAvailEnd = TimeUtils.parseTimeToMinutes(technician.availabilityEnd);
    if (startMins < techAvailStart || endMins > techAvailEnd) {
      violations.push({
        code: 'OUTSIDE_AVAILABILITY',
        requestId: request.id,
        technicianId: technician.id,
        message: `Assignment time (${assignment.startTime}-${assignment.endTime}) is outside technician ${technician.name}'s working hours (${technician.availabilityStart}-${technician.availabilityEnd}).`,
      });
    }

    const reqPrefStart = TimeUtils.parseTimeToMinutes(request.preferredStartTime);
    const reqPrefEnd = TimeUtils.parseTimeToMinutes(request.preferredEndTime);
    if (startMins < reqPrefStart || endMins > reqPrefEnd) {
      violations.push({
        code: 'OUTSIDE_PREFERRED_WINDOW',
        requestId: request.id,
        technicianId: technician.id,
        message: `Assignment time (${assignment.startTime}-${assignment.endTime}) is outside customer's preferred window (${request.preferredStartTime}-${request.preferredEndTime}).`,
      });
    }

    const assignedDuration = endMins - startMins;
    if (assignedDuration !== request.estimatedDurationMinutes) {
      violations.push({
        code: 'DURATION_MISMATCH',
        requestId: request.id,
        technicianId: technician.id,
        message: `Assigned duration (${assignedDuration} mins) does not match estimated duration (${request.estimatedDurationMinutes} mins) for request ${request.id}.`,
      });
    }

    return violations;
  }
}

export class ClientPlanner {
  private static priorityWeight(priority: string): number {
    switch (priority) {
      case 'CRITICAL': return 4;
      case 'HIGH': return 3;
      case 'MEDIUM': return 2;
      case 'LOW': return 1;
      default: return 0;
    }
  }

  static generatePlan(params: {
    technicians: Technician[];
    requests: ServiceRequest[];
    existingCompletedAssignments?: Assignment[];
    trigger?: string;
  }): ValidatedAiPlanResponse {
    const { technicians, requests, existingCompletedAssignments = [], trigger = 'INITIAL_PLAN' } = params;

    const proposedAssignments: ProposedAssignment[] = [];
    const unassignedRequests: ProposedUnassignedRequest[] = [];
    const tradeoffs: string[] = [];
    const questions: string[] = [];

    const completedReqIds = new Set<string>();
    for (const comp of existingCompletedAssignments) {
      completedReqIds.add(comp.requestId);
      proposedAssignments.push({
        requestId: comp.requestId,
        technicianId: comp.technicianId,
        startTime: comp.startTime,
        endTime: comp.endTime,
        status: 'COMPLETED',
        source: comp.source,
        reason: 'Preserved completed assignment.',
      });
    }

    const requestsToSchedule = requests.filter((r) => r.status !== 'CANCELLED' && !completedReqIds.has(r.id));
    requestsToSchedule.sort((a, b) => {
      if (a.isEmergency !== b.isEmergency) return a.isEmergency ? -1 : 1;
      const pA = this.priorityWeight(a.priority);
      const pB = this.priorityWeight(b.priority);
      if (pA !== pB) return pB - pA;
      return TimeUtils.parseTimeToMinutes(a.preferredStartTime) - TimeUtils.parseTimeToMinutes(b.preferredStartTime);
    });

    const techAssignmentsMap = new Map<string, ProposedAssignment[]>();
    for (const t of technicians) techAssignmentsMap.set(t.id, []);
    for (const comp of proposedAssignments) techAssignmentsMap.get(comp.technicianId)?.push(comp);

    for (const req of requestsToSchedule) {
      const reqDuration = req.estimatedDurationMinutes;
      const reqPrefStart = TimeUtils.parseTimeToMinutes(req.preferredStartTime);
      const reqPrefEnd = TimeUtils.parseTimeToMinutes(req.preferredEndTime);

      if (reqPrefStart === -1 || reqPrefEnd === -1 || reqPrefEnd - reqPrefStart < reqDuration) {
        unassignedRequests.push({
          requestId: req.id,
          reason: `Invalid or insufficient preferred time window (${req.preferredStartTime}-${req.preferredEndTime}) for ${reqDuration}min duration.`,
        });
        continue;
      }

      const compatibleTechs = technicians.filter((tech) => {
        if (tech.status === 'CANCELLED') return false;
        if (tech.region.trim().toLowerCase() !== req.region.trim().toLowerCase()) return false;
        const skills = tech.skills.split(',').map((s) => s.trim().toLowerCase());
        return skills.includes(req.requiredSkill.trim().toLowerCase());
      });

      if (compatibleTechs.length === 0) {
        const matchingRegion = technicians.filter((t) => t.region.trim().toLowerCase() === req.region.trim().toLowerCase());
        let reason = `No technician found with required skill '${req.requiredSkill}' in '${req.region}' region.`;
        if (matchingRegion.length === 0) {
          reason = `No active technicians operate in region '${req.region}'.`;
        }
        unassignedRequests.push({ requestId: req.id, reason });
        continue;
      }

      compatibleTechs.sort((a, b) => {
        const loadA = (techAssignmentsMap.get(a.id) || []).reduce((sum, a) => sum + (TimeUtils.parseTimeToMinutes(a.endTime) - TimeUtils.parseTimeToMinutes(a.startTime)), 0);
        const loadB = (techAssignmentsMap.get(b.id) || []).reduce((sum, b) => sum + (TimeUtils.parseTimeToMinutes(b.endTime) - TimeUtils.parseTimeToMinutes(b.startTime)), 0);
        return loadA - loadB;
      });

      let assigned = false;
      for (const tech of compatibleTechs) {
        const currentTechAssignments = techAssignmentsMap.get(tech.id) || [];
        const currentLoad = currentTechAssignments.reduce((sum, a) => sum + (TimeUtils.parseTimeToMinutes(a.endTime) - TimeUtils.parseTimeToMinutes(a.startTime)), 0);

        if (currentLoad + reqDuration > tech.maxWorkloadMinutes) continue;

        const techAvailStart = TimeUtils.parseTimeToMinutes(tech.availabilityStart);
        const techAvailEnd = TimeUtils.parseTimeToMinutes(tech.availabilityEnd);
        const windowStart = Math.max(reqPrefStart, techAvailStart);
        const windowEnd = Math.min(reqPrefEnd, techAvailEnd);

        if (windowEnd - windowStart < reqDuration) continue;

        for (let slotStart = windowStart; slotStart + reqDuration <= windowEnd; slotStart += 15) {
          const slotEnd = slotStart + reqDuration;
          const hasOverlap = currentTechAssignments.some((existing) => {
            const eStart = TimeUtils.parseTimeToMinutes(existing.startTime);
            const eEnd = TimeUtils.parseTimeToMinutes(existing.endTime);
            return TimeUtils.doIntervalsOverlap(slotStart, slotEnd, eStart, eEnd);
          });

          if (!hasOverlap) {
            const proposed: ProposedAssignment = {
              requestId: req.id,
              technicianId: tech.id,
              startTime: TimeUtils.minutesToTime(slotStart),
              endTime: TimeUtils.minutesToTime(slotEnd),
              source: 'AI',
              status: 'SCHEDULED',
              reason: `AI optimization: ${tech.name} selected for ${req.title} (${req.priority}) due to verified '${req.requiredSkill}' qualification in '${req.region}' region during slot ${TimeUtils.minutesToTime(slotStart)}-${TimeUtils.minutesToTime(slotEnd)}.`,
            };

            const violations = ClientConstraintEngine.validateSingleAssignment({
              assignment: proposed,
              technician: tech,
              request: req,
            });

            if (violations.length === 0) {
              proposedAssignments.push(proposed);
              techAssignmentsMap.get(tech.id)?.push(proposed);
              assigned = true;
              break;
            }
          }
        }
        if (assigned) break;
      }

      if (!assigned) {
        unassignedRequests.push({
          requestId: req.id,
          reason: `Technicians with skill '${req.requiredSkill}' (${compatibleTechs.map((t) => t.name).join(', ')}) have scheduling conflicts or capacity limits in window ${req.preferredStartTime}-${req.preferredEndTime}.`,
        });
      }
    }

    if (unassignedRequests.length > 0) {
      tradeoffs.push(`${unassignedRequests.length} request(s) left unassigned due to strict region, skill, or schedule window constraints.`);
    }
    if (trigger === 'INITIAL_PLAN') {
      tradeoffs.push('Balanced technician workload across North and South regions while prioritizing CRITICAL & HIGH service tickets.');
    } else if (trigger === 'TECHNICIAN_CANCELLATION') {
      tradeoffs.push('Reallocated orphaned tasks to qualified technicians in the same region without modifying completed tasks.');
    } else if (trigger === 'EMERGENCY_REQUEST') {
      tradeoffs.push('Accommodated critical emergency work order immediately in customer window.');
    }

    const overall = ClientConstraintEngine.validateSchedule({
      proposedAssignments,
      technicians,
      requests,
      baseCompletedAssignments: existingCompletedAssignments,
    });

    const annotated: ProposedAssignment[] = proposedAssignments.map((a) => {
      const tech = technicians.find((t) => t.id === a.technicianId);
      const req = requests.find((r) => r.id === a.requestId);
      let v: Violation[] = [];
      if (tech && req) {
        v = ClientConstraintEngine.validateSingleAssignment({ assignment: a, technician: tech, request: req });
      }
      return { ...a, isValid: v.length === 0, violations: v };
    });

    return {
      assignments: annotated,
      unassignedRequests,
      tradeoffs,
      questions,
      validationSummary: {
        isValid: overall.valid,
        totalProposed: annotated.length,
        validCount: annotated.filter((a) => a.isValid).length,
        invalidCount: annotated.filter((a) => !a.isValid).length,
        violations: overall.violations,
      },
    };
  }
}

export class ClientDiffEngine {
  static computeDiff(params: {
    previousAssignments: Assignment[];
    newAssignments: ProposedAssignment[];
    unassignedRequests: ProposedUnassignedRequest[];
    requests: ServiceRequest[];
    technicians: Technician[];
    tradeoffs?: string[];
  }): ScheduleDiff {
    const { previousAssignments, newAssignments, unassignedRequests, requests, technicians, tradeoffs = [] } = params;

    const reqMap = new Map(requests.map((r) => [r.id, r]));
    const techMap = new Map(technicians.map((t) => [t.id, t]));
    const prevMap = new Map(previousAssignments.map((a) => [a.requestId, a]));
    const newMap = new Map(newAssignments.map((a) => [a.requestId, a]));

    const changes: any[] = [];

    for (const prev of previousAssignments) {
      const req = reqMap.get(prev.requestId);
      const reqTitle = req ? req.title : prev.requestId;
      const next = newMap.get(prev.requestId);

      if (!next) {
        const unassignedReason = unassignedRequests.find((u) => u.requestId === prev.requestId)?.reason || 'Technician capacity or constraint conflict in revised plan.';
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

    return {
      summary: {
        totalChanged: changes.filter((c) => c.type === 'CHANGED').length,
        totalUnassigned: changes.filter((c) => c.type === 'UNASSIGNED').length,
        totalAdded: changes.filter((c) => c.type === 'ADDED').length,
        totalPreserved: changes.filter((c) => c.type === 'UNCHANGED').length,
      },
      changes,
      tradeoffs,
    };
  }
}

// Initial Seed Constants for In-Memory Storage
export const INITIAL_TECHNICIANS: Technician[] = [
  { id: 'T1', name: 'Alex Miller', skills: 'Electrical,HVAC', region: 'North', availabilityStart: '08:00', availabilityEnd: '17:00', maxWorkloadMinutes: 480, status: 'AVAILABLE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'T2', name: 'Sarah Chen', skills: 'Plumbing,Appliance', region: 'North', availabilityStart: '08:30', availabilityEnd: '16:30', maxWorkloadMinutes: 420, status: 'AVAILABLE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'T3', name: 'Marcus Johnson', skills: 'Electrical,Appliance', region: 'North', availabilityStart: '09:00', availabilityEnd: '17:00', maxWorkloadMinutes: 480, status: 'AVAILABLE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'T4', name: 'Elena Rodriguez', skills: 'HVAC,Plumbing', region: 'South', availabilityStart: '08:00', availabilityEnd: '16:00', maxWorkloadMinutes: 480, status: 'AVAILABLE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'T5', name: 'David Kim', skills: 'Electrical,HVAC', region: 'South', availabilityStart: '08:00', availabilityEnd: '17:00', maxWorkloadMinutes: 480, status: 'AVAILABLE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export const INITIAL_REQUESTS: ServiceRequest[] = [
  { id: 'R1', title: 'Commercial Circuit Breaker Tripping', description: 'Main electrical distribution panel overheating and tripping under peak office load.', region: 'North', requiredSkill: 'Electrical', priority: 'HIGH', estimatedDurationMinutes: 120, preferredStartTime: '09:00', preferredEndTime: '12:00', status: 'UNASSIGNED', isEmergency: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'R2', title: 'Main Water Line Leak in Server Basement', description: 'Severe pipe rupture causing water accumulation near server backup batteries.', region: 'North', requiredSkill: 'Plumbing', priority: 'CRITICAL', estimatedDurationMinutes: 90, preferredStartTime: '09:00', preferredEndTime: '11:30', status: 'UNASSIGNED', isEmergency: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'R3', title: 'Data Center Primary AC Unit Failure', description: 'Chiller compressor fault causing temperature rise in rack zone B.', region: 'North', requiredSkill: 'HVAC', priority: 'HIGH', estimatedDurationMinutes: 90, preferredStartTime: '13:00', preferredEndTime: '15:30', status: 'UNASSIGNED', isEmergency: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'R4', title: 'Industrial Kitchen Combi-Oven Error 404', description: 'Heating element sensor failure preventing lunch meal preparation.', region: 'North', requiredSkill: 'Appliance', priority: 'MEDIUM', estimatedDurationMinutes: 120, preferredStartTime: '11:00', preferredEndTime: '14:00', status: 'UNASSIGNED', isEmergency: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'R5', title: 'Backup Diesel Generator Annual Inspection', description: 'Routine scheduled electrical insulation and load test.', region: 'North', requiredSkill: 'Electrical', priority: 'LOW', estimatedDurationMinutes: 120, preferredStartTime: '14:00', preferredEndTime: '17:00', status: 'UNASSIGNED', isEmergency: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'R6', title: 'Office Complex HVAC Air Duct Inspection', description: 'Check air balance and damper actuators across 3rd floor office suite.', region: 'South', requiredSkill: 'HVAC', priority: 'MEDIUM', estimatedDurationMinutes: 120, preferredStartTime: '09:00', preferredEndTime: '12:00', status: 'UNASSIGNED', isEmergency: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'R7', title: 'Cafeteria Commercial Grease Trap Repair', description: 'Clogged drainage line with potential overflow risk in cafeteria.', region: 'South', requiredSkill: 'Plumbing', priority: 'HIGH', estimatedDurationMinutes: 90, preferredStartTime: '10:00', preferredEndTime: '13:00', status: 'UNASSIGNED', isEmergency: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'R8', title: 'Substation Transformer Diagnostics', description: 'Voltage irregularity on primary 480V distribution transformer.', region: 'South', requiredSkill: 'Electrical', priority: 'CRITICAL', estimatedDurationMinutes: 120, preferredStartTime: '13:00', preferredEndTime: '16:00', status: 'UNASSIGNED', isEmergency: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'R9', title: 'Residential Heat Pump Thermostat Calibration', description: 'Heat pump cycling short cycles during morning heating cycle.', region: 'South', requiredSkill: 'HVAC', priority: 'LOW', estimatedDurationMinutes: 90, preferredStartTime: '14:30', preferredEndTime: '16:30', status: 'UNASSIGNED', isEmergency: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'R10', title: 'Solar Inverter High-Voltage Calibration', description: 'Requires certified Solar Specialist credential in East region.', region: 'East', requiredSkill: 'SolarSpecialist', priority: 'MEDIUM', estimatedDurationMinutes: 120, preferredStartTime: '10:00', preferredEndTime: '14:00', status: 'UNASSIGNED', isEmergency: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export class ClientStore {
  private static STORAGE_KEY = 'aggroso_field_service_db';

  private static getState() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    const initial = {
      technicians: INITIAL_TECHNICIANS,
      requests: INITIAL_REQUESTS,
      schedules: [] as ScheduleVersion[],
      auditLogs: [
        {
          id: 'log-init',
          action: 'SYSTEM_INITIALIZED',
          entityType: 'SYSTEM',
          entityId: 'SYSTEM',
          reason: 'Demo database seeded with technicians and service requests for daily dispatch.',
          actor: 'System Seed',
          createdAt: new Date().toISOString(),
        },
      ] as AuditLog[],
      notifications: [] as NotificationItem[],
    };
    this.saveState(initial);
    return initial;
  }

  private static saveState(state: any) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  static getTechnicians(): Technician[] {
    const state = this.getState();
    const curr = this.getCurrentSchedule();
    return state.technicians.map((t: Technician) => {
      const assignments = curr?.assignments.filter((a) => a.technicianId === t.id) || [];
      const currentWorkloadMinutes = assignments.reduce((sum, a) => {
        const s = TimeUtils.parseTimeToMinutes(a.startTime);
        const e = TimeUtils.parseTimeToMinutes(a.endTime);
        return sum + (e > s ? e - s : 0);
      }, 0);
      return {
        ...t,
        skillsList: t.skills.split(',').map((s) => s.trim()),
        currentWorkloadMinutes,
        assignedJobsCount: assignments.length,
      };
    });
  }

  static getRequests(): ServiceRequest[] {
    const state = this.getState();
    const curr = this.getCurrentSchedule();
    return state.requests.map((r: ServiceRequest) => {
      const active = curr?.assignments.find((a) => a.requestId === r.id && a.status !== 'CANCELLED');
      const tech = active ? state.technicians.find((t: Technician) => t.id === active.technicianId) : null;
      return {
        ...r,
        currentAssignment: active
          ? {
              id: active.id,
              technicianId: active.technicianId,
              technicianName: tech?.name || active.technicianId,
              startTime: active.startTime,
              endTime: active.endTime,
              status: active.status,
              source: active.source,
            }
          : null,
      };
    });
  }

  static getCurrentSchedule(): ScheduleVersion | null {
    const state = this.getState();
    const approved = (state.schedules || []).filter((s: ScheduleVersion) => s.status === 'APPROVED');
    if (approved.length === 0) return null;
    approved.sort((a: ScheduleVersion, b: ScheduleVersion) => b.versionNumber - a.versionNumber);
    return approved[0];
  }

  static getScheduleVersions(): ScheduleVersion[] {
    const state = this.getState();
    const versions = state.schedules || [];
    return [...versions].sort((a: ScheduleVersion, b: ScheduleVersion) => b.versionNumber - a.versionNumber);
  }

  static generatePlan(trigger = 'INITIAL_PLAN', notes?: string) {
    const state = this.getState();
    const current = this.getCurrentSchedule();
    const completed = current?.assignments.filter((a) => a.status === 'COMPLETED') || [];
    const proposal = ClientPlanner.generatePlan({
      technicians: state.technicians,
      requests: state.requests,
      existingCompletedAssignments: completed,
      trigger,
    });

    let diff = null;
    if (current) {
      diff = ClientDiffEngine.computeDiff({
        previousAssignments: current.assignments,
        newAssignments: proposal.assignments,
        unassignedRequests: proposal.unassignedRequests,
        requests: state.requests,
        technicians: state.technicians,
        tradeoffs: proposal.tradeoffs,
      });
    }

    return { proposal, diff, baseScheduleVersionId: current?.id || null };
  }

  static approveSchedule(params: { proposedAssignments: ProposedAssignment[]; trigger?: string; actor?: string; metadata?: any }) {
    const state = this.getState();
    const { proposedAssignments, trigger = 'INITIAL_PLAN', actor = 'Dispatcher', metadata } = params;
    const current = this.getCurrentSchedule();
    const completed = current?.assignments.filter((a) => a.status === 'COMPLETED') || [];

    const validation = ClientConstraintEngine.validateSchedule({
      proposedAssignments,
      technicians: state.technicians,
      requests: state.requests,
      baseCompletedAssignments: completed,
    });

    if (!validation.valid) {
      const err: any = new Error('Schedule failed deterministic constraint validation. Cannot approve.');
      err.violations = validation.violations;
      throw err;
    }

    if (current) {
      current.status = 'SUPERSEDED';
    }

    const nextVer = (current?.versionNumber || 0) + 1;
    const newScheduleId = `SCH-V${nextVer}-${Date.now()}`;

    const createdAssignments: Assignment[] = proposedAssignments.map((p, idx) => ({
      id: `ASG-${nextVer}-${idx + 1}`,
      scheduleVersionId: newScheduleId,
      requestId: p.requestId,
      technicianId: p.technicianId,
      startTime: p.startTime,
      endTime: p.endTime,
      status: p.status || 'SCHEDULED',
      source: p.source || 'AI',
      reasoning: p.reason,
      createdAt: new Date().toISOString(),
    }));

    const newSchedule: ScheduleVersion = {
      id: newScheduleId,
      versionNumber: nextVer,
      status: 'APPROVED',
      trigger: trigger as any,
      createdBy: actor,
      metadata,
      assignments: createdAssignments,
      createdAt: new Date().toISOString(),
    };

    state.schedules = state.schedules || [];
    state.schedules.push(newSchedule);

    // Update request statuses
    const assignedIds = new Set(proposedAssignments.map((a) => a.requestId));
    state.requests = state.requests.map((r: ServiceRequest) => {
      if (r.status === 'COMPLETED') return r;
      return {
        ...r,
        status: assignedIds.has(r.id) ? 'ASSIGNED' : 'UNASSIGNED',
      };
    });

    // Notifications
    const newNotifs: NotificationItem[] = [];
    for (const a of createdAssignments) {
      const tech = state.technicians.find((t: Technician) => t.id === a.technicianId);
      const req = state.requests.find((r: ServiceRequest) => r.id === a.requestId);
      newNotifs.push({
        id: `NOTIF-${Date.now()}-${a.id}-1`,
        assignmentId: a.id,
        recipientType: 'TECHNICIAN',
        recipientId: a.technicianId,
        message: `New Assignment Confirmed: Job ${a.requestId} ("${req?.title}") scheduled for ${a.startTime}–${a.endTime} (Schedule v${nextVer}).`,
        status: 'SENT',
        createdAt: new Date().toISOString(),
      });
      newNotifs.push({
        id: `NOTIF-${Date.now()}-${a.id}-2`,
        assignmentId: a.id,
        recipientType: 'CUSTOMER',
        recipientId: `REQ-${a.requestId}`,
        message: `Your service visit for "${req?.title}" has been confirmed with technician ${tech?.name} for ${a.startTime}–${a.endTime}.`,
        status: 'SENT',
        createdAt: new Date().toISOString(),
      });
    }

    state.notifications = [...newNotifs, ...(state.notifications || [])];

    // Audit Log
    state.auditLogs = [
      {
        id: `log-${Date.now()}`,
        action: 'SCHEDULE_APPROVED',
        entityType: 'SCHEDULE_VERSION',
        entityId: newSchedule.id,
        newValue: JSON.stringify({ versionNumber: nextVer, count: createdAssignments.length, trigger }),
        reason: `Schedule Version ${nextVer} approved by ${actor} (Trigger: ${trigger}).`,
        actor,
        createdAt: new Date().toISOString(),
      },
      ...(state.auditLogs || []),
    ];

    this.saveState(state);
    return { message: `Schedule Version ${nextVer} approved and confirmed successfully.`, schedule: newSchedule, notificationsCount: newNotifs.length };
  }

  static cancelTechnicianAndReplan(technicianId: string, actor = 'Dispatcher') {
    const state = this.getState();
    const tech = state.technicians.find((t: Technician) => t.id === technicianId);
    if (!tech) throw new Error(`Technician ${technicianId} not found`);

    tech.status = 'CANCELLED';

    state.auditLogs = [
      {
        id: `log-${Date.now()}`,
        action: 'TECHNICIAN_CANCELLED',
        entityType: 'TECHNICIAN',
        entityId: technicianId,
        reason: `Technician ${tech.name} reported unexpected unavailability/sick leave.`,
        actor,
        createdAt: new Date().toISOString(),
      },
      ...(state.auditLogs || []),
    ];

    const current = this.getCurrentSchedule();
    const completed = current?.assignments.filter((a) => a.status === 'COMPLETED') || [];
    const affected = current?.assignments.filter((a) => a.technicianId === technicianId && a.status !== 'COMPLETED') || [];

    const proposedPlan = ClientPlanner.generatePlan({
      technicians: state.technicians,
      requests: state.requests,
      existingCompletedAssignments: completed,
      trigger: 'TECHNICIAN_CANCELLATION',
    });

    const diff = ClientDiffEngine.computeDiff({
      previousAssignments: current?.assignments || [],
      newAssignments: proposedPlan.assignments,
      unassignedRequests: proposedPlan.unassignedRequests,
      requests: state.requests,
      technicians: state.technicians,
      tradeoffs: proposedPlan.tradeoffs,
    });

    this.saveState(state);
    return {
      message: `Technician ${technicianId} marked CANCELLED. Replanning proposal generated.`,
      trigger: 'TECHNICIAN_CANCELLATION',
      proposedPlan,
      diff,
      context: { cancelledTechnician: tech, affectedCount: affected.length, affectedRequestIds: affected.map((a) => a.requestId) },
    };
  }

  static restoreTechnician(technicianId: string) {
    const state = this.getState();
    const tech = state.technicians.find((t: Technician) => t.id === technicianId);
    if (tech) {
      tech.status = 'AVAILABLE';
      state.auditLogs = [
        {
          id: `log-${Date.now()}`,
          action: 'TECHNICIAN_RESTORED',
          entityType: 'TECHNICIAN',
          entityId: technicianId,
          reason: `Technician ${tech.name} restored to AVAILABLE status.`,
          actor: 'Dispatcher',
          createdAt: new Date().toISOString(),
        },
        ...(state.auditLogs || []),
      ];
      this.saveState(state);
    }
    return tech;
  }

  static addEmergencyRequestAndReplan(data: any) {
    const state = this.getState();
    const count = (state.requests || []).length;
    const reqId = `R-EMG-${count + 1}`;

    const newReq: ServiceRequest = {
      id: reqId,
      title: data.title,
      description: data.description || 'Critical emergency dispatched directly.',
      region: data.region,
      requiredSkill: data.requiredSkill,
      priority: 'CRITICAL',
      estimatedDurationMinutes: Number(data.estimatedDurationMinutes),
      preferredStartTime: data.preferredStartTime,
      preferredEndTime: data.preferredEndTime,
      status: 'UNASSIGNED',
      isEmergency: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.requests = state.requests || [];
    state.requests.push(newReq);

    state.auditLogs = [
      {
        id: `log-${Date.now()}`,
        action: 'EMERGENCY_REQUEST_CREATED',
        entityType: 'SERVICE_REQUEST',
        entityId: newReq.id,
        reason: `Critical emergency ticket created: ${newReq.title}`,
        actor: data.actor || 'Dispatcher',
        createdAt: new Date().toISOString(),
      },
      ...(state.auditLogs || []),
    ];

    const current = this.getCurrentSchedule();
    const completed = current?.assignments.filter((a) => a.status === 'COMPLETED') || [];

    const proposedPlan = ClientPlanner.generatePlan({
      technicians: state.technicians,
      requests: state.requests,
      existingCompletedAssignments: completed,
      trigger: 'EMERGENCY_REQUEST',
    });

    const diff = ClientDiffEngine.computeDiff({
      previousAssignments: current?.assignments || [],
      newAssignments: proposedPlan.assignments,
      unassignedRequests: proposedPlan.unassignedRequests,
      requests: state.requests,
      technicians: state.technicians,
      tradeoffs: proposedPlan.tradeoffs,
    });

    this.saveState(state);
    return {
      message: 'Emergency request created. Revised schedule proposal generated.',
      trigger: 'EMERGENCY_REQUEST',
      proposedPlan,
      diff,
      context: { emergencyRequest: newReq },
    };
  }

  static updateAssignment(id: string, data: any) {
    const state = this.getState();
    const current = this.getCurrentSchedule();
    if (!current) throw new Error('No active schedule');

    const assignment = current.assignments.find((a) => a.id === id);
    if (!assignment) throw new Error(`Assignment ${id} not found`);
    if (assignment.status === 'COMPLETED') {
      const err: any = new Error('Completed assignments cannot be modified.');
      err.violations = [{ code: 'COMPLETED_ASSIGNMENT_MODIFIED', message: 'Completed jobs are locked.' }];
      throw err;
    }

    const targetTechId = data.technicianId || assignment.technicianId;
    const targetStart = data.startTime || assignment.startTime;
    const targetEnd = data.endTime || assignment.endTime;

    const hypothetical: ProposedAssignment[] = current.assignments.map((a) => {
      if (a.id === id) {
        return { requestId: a.requestId, technicianId: targetTechId, startTime: targetStart, endTime: targetEnd, status: a.status, source: 'MANUAL' };
      }
      return { requestId: a.requestId, technicianId: a.technicianId, startTime: a.startTime, endTime: a.endTime, status: a.status, source: a.source };
    });

    const validation = ClientConstraintEngine.validateSchedule({
      proposedAssignments: hypothetical,
      technicians: state.technicians,
      requests: state.requests,
    });

    if (!validation.valid) {
      const err: any = new Error('Manual assignment update violates scheduling constraints.');
      err.violations = validation.violations;
      throw err;
    }

    assignment.technicianId = targetTechId;
    assignment.startTime = targetStart;
    assignment.endTime = targetEnd;
    assignment.source = 'MANUAL';
    assignment.reasoning = data.reason || 'Manual dispatcher override';

    state.auditLogs = [
      {
        id: `log-${Date.now()}`,
        action: 'MANUAL_ASSIGNMENT_OVERRIDE',
        entityType: 'ASSIGNMENT',
        entityId: id,
        reason: data.reason || `Dispatcher manual adjustment on ticket ${assignment.requestId}`,
        actor: data.actor || 'Dispatcher',
        createdAt: new Date().toISOString(),
      },
      ...(state.auditLogs || []),
    ];

    this.saveState(state);
    return { message: 'Assignment successfully updated and validated.', assignment };
  }

  static completeAssignment(id: string, actor = 'Dispatcher') {
    const state = this.getState();
    const current = this.getCurrentSchedule();
    if (!current) throw new Error('No active schedule');

    const assignment = current.assignments.find((a) => a.id === id);
    if (!assignment) throw new Error(`Assignment ${id} not found`);

    assignment.status = 'COMPLETED';

    const req = state.requests.find((r: ServiceRequest) => r.id === assignment.requestId);
    if (req) req.status = 'COMPLETED';

    state.auditLogs = [
      {
        id: `log-${Date.now()}`,
        action: 'ASSIGNMENT_COMPLETED',
        entityType: 'ASSIGNMENT',
        entityId: id,
        reason: `Field work for request ${assignment.requestId} completed successfully.`,
        actor,
        createdAt: new Date().toISOString(),
      },
      ...(state.auditLogs || []),
    ];

    this.saveState(state);
    return { message: `Assignment ${id} marked COMPLETED.`, assignment };
  }

  static getAuditLogs(): AuditLog[] {
    const state = this.getState();
    return state.auditLogs || [];
  }

  static getNotifications(): NotificationItem[] {
    const state = this.getState();
    return state.notifications || [];
  }

  static markNotificationsAsRead() {
    const state = this.getState();
    state.notifications = (state.notifications || []).map((n: NotificationItem) => ({ ...n, status: 'READ' }));
    this.saveState(state);
    return { message: 'All notifications marked as read' };
  }

  static resetDemo() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.getState();
    return { message: 'Demo database reset to initial seeded state successfully.' };
  }
}
