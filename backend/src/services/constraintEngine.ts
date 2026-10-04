import {
  ProposedAssignment,
  ValidationResult,
  Violation,
} from '../types/index.js';
import { Technician, ServiceRequest, Assignment } from '@prisma/client';

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

  static isValidTime(timeStr: string): boolean {
    return this.parseTimeToMinutes(timeStr) !== -1;
  }

  static doIntervalsOverlap(
    startA: number,
    endA: number,
    startB: number,
    endB: number
  ): boolean {
    return startA < endB && startB < endA;
  }
}

export class ConstraintValidationService {
  /**
   * Validates a full set of proposed assignments for a schedule version.
   */
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

    // 1. Check Completed Assignments Protection
    for (const completed of baseCompletedAssignments) {
      const match = proposedAssignments.find((p) => p.requestId === completed.requestId);
      if (!match) {
        violations.push({
          code: 'COMPLETED_ASSIGNMENT_MODIFIED',
          requestId: completed.requestId,
          message: `Completed assignment for request ${completed.requestId} was removed from the schedule.`,
        });
      } else {
        if (
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
    }

    // 2. Validate each assignment individually
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

      // Check single assignment constraints
      const singleViolations = this.validateSingleAssignment({
        assignment,
        technician: tech,
        request: req,
      });
      violations.push(...singleViolations);
    }

    // 3. Validate Cross-Assignment Constraints (Double Booking & Max Workload)
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

      // Double booking check
      for (let i = 0; i < techAssignments.length; i++) {
        for (let j = i + 1; j < techAssignments.length; j++) {
          const a1 = techAssignments[i];
          const a2 = techAssignments[j];

          const start1 = TimeUtils.parseTimeToMinutes(a1.startTime);
          const end1 = TimeUtils.parseTimeToMinutes(a1.endTime);
          const start2 = TimeUtils.parseTimeToMinutes(a2.startTime);
          const end2 = TimeUtils.parseTimeToMinutes(a2.endTime);

          if (start1 !== -1 && end1 !== -1 && start2 !== -1 && end2 !== -1) {
            if (TimeUtils.doIntervalsOverlap(start1, end1, start2, end2)) {
              violations.push({
                code: 'DOUBLE_BOOKING',
                technicianId: techId,
                requestId: `${a1.requestId} & ${a2.requestId}`,
                message: `Double booking for technician ${tech.name} (${techId}): Request ${a1.requestId} (${a1.startTime}-${a1.endTime}) overlaps with Request ${a2.requestId} (${a2.startTime}-${a2.endTime}).`,
              });
            }
          }
        }
      }

      // Max workload check
      let totalAssignedMinutes = 0;
      for (const a of techAssignments) {
        const start = TimeUtils.parseTimeToMinutes(a.startTime);
        const end = TimeUtils.parseTimeToMinutes(a.endTime);
        if (start !== -1 && end !== -1 && end > start) {
          totalAssignedMinutes += end - start;
        }
      }

      if (totalAssignedMinutes > tech.maxWorkloadMinutes) {
        violations.push({
          code: 'WORKLOAD_EXCEEDED',
          technicianId: techId,
          message: `Technician ${tech.name} (${techId}) exceeds maximum daily workload: assigned ${totalAssignedMinutes} mins (Max: ${tech.maxWorkloadMinutes} mins).`,
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Validates single assignment isolated from other assignments
   */
  static validateSingleAssignment(params: {
    assignment: ProposedAssignment;
    technician: Technician;
    request: ServiceRequest;
  }): Violation[] {
    const { assignment, technician, request } = params;
    const violations: Violation[] = [];

    // 1. Time string validity
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

    // 2. Technician Cancellation
    if (technician.status === 'CANCELLED') {
      violations.push({
        code: 'TECHNICIAN_CANCELLED',
        requestId: request.id,
        technicianId: technician.id,
        message: `Cannot assign request to technician ${technician.name} (${technician.id}) because they are CANCELLED.`,
      });
    }

    // 3. Request Status
    if (request.status === 'CANCELLED') {
      violations.push({
        code: 'REQUEST_CANCELLED',
        requestId: request.id,
        technicianId: technician.id,
        message: `Cannot assign request ${request.id} because it is CANCELLED.`,
      });
    }

    // 4. Required Skill check
    const techSkills = technician.skills.split(',').map((s) => s.trim().toLowerCase());
    const reqSkill = request.requiredSkill.trim().toLowerCase();
    if (!techSkills.includes(reqSkill)) {
      violations.push({
        code: 'SKILL_MISMATCH',
        requestId: request.id,
        technicianId: technician.id,
        message: `Technician ${technician.name} does not have the required skill '${request.requiredSkill}' (Has: ${technician.skills}).`,
      });
    }

    // 5. Region check
    if (technician.region.trim().toLowerCase() !== request.region.trim().toLowerCase()) {
      violations.push({
        code: 'REGION_MISMATCH',
        requestId: request.id,
        technicianId: technician.id,
        message: `Region mismatch: Technician ${technician.name} is in '${technician.region}', but Request ${request.id} is in '${request.region}'.`,
      });
    }

    // 6. Technician Availability Window
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

    // 7. Request Preferred Window
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

    // 8. Duration Match
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
