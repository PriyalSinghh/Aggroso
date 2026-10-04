import {
  AiPlanOutput,
  ProposedAssignment,
  ProposedUnassignedRequest,
} from '../types/index.js';
import { Technician, ServiceRequest, Assignment } from '@prisma/client';
import { ConstraintValidationService, TimeUtils } from './constraintEngine.js';

export class DeterministicPlannerService {
  private static priorityWeight(priority: string): number {
    switch (priority) {
      case 'CRITICAL':
        return 4;
      case 'HIGH':
        return 3;
      case 'MEDIUM':
        return 2;
      case 'LOW':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Generates a valid plan using a deterministic heuristic algorithm.
   */
  static generatePlan(params: {
    technicians: Technician[];
    requests: ServiceRequest[];
    existingCompletedAssignments?: Assignment[];
    trigger?: string;
  }): AiPlanOutput {
    const {
      technicians,
      requests,
      existingCompletedAssignments = [],
      trigger = 'INITIAL_PLAN',
    } = params;

    const proposedAssignments: ProposedAssignment[] = [];
    const unassignedRequests: ProposedUnassignedRequest[] = [];
    const tradeoffs: string[] = [];
    const questions: string[] = [];

    // 1. Keep completed assignments locked
    const completedReqIds = new Set<string>();
    for (const completed of existingCompletedAssignments) {
      completedReqIds.add(completed.requestId);
      proposedAssignments.push({
        requestId: completed.requestId,
        technicianId: completed.technicianId,
        startTime: completed.startTime,
        endTime: completed.endTime,
        status: 'COMPLETED',
        source: completed.source as any,
        reason: 'Preserved completed assignment.',
      });
    }

    // 2. Filter requests to schedule
    const requestsToSchedule = requests.filter(
      (r) => r.status !== 'CANCELLED' && !completedReqIds.has(r.id)
    );

    // 3. Sort requests by priority, emergency, and preferred start time
    requestsToSchedule.sort((a, b) => {
      if (a.isEmergency !== b.isEmergency) {
        return a.isEmergency ? -1 : 1;
      }
      const pA = this.priorityWeight(a.priority);
      const pB = this.priorityWeight(b.priority);
      if (pA !== pB) {
        return pB - pA; // Higher priority first
      }
      return (
        TimeUtils.parseTimeToMinutes(a.preferredStartTime) -
        TimeUtils.parseTimeToMinutes(b.preferredStartTime)
      );
    });

    // 4. Map for tracking technician assignments during planning
    const techAssignmentsMap = new Map<string, ProposedAssignment[]>();
    for (const t of technicians) {
      techAssignmentsMap.set(t.id, []);
    }
    for (const comp of proposedAssignments) {
      techAssignmentsMap.get(comp.technicianId)?.push(comp);
    }

    // 5. Schedule each request
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

      // Find compatible technicians
      const compatibleTechs = technicians.filter((tech) => {
        if (tech.status === 'CANCELLED') return false;
        if (tech.region.trim().toLowerCase() !== req.region.trim().toLowerCase()) return false;
        const skills = tech.skills.split(',').map((s) => s.trim().toLowerCase());
        return skills.includes(req.requiredSkill.trim().toLowerCase());
      });

      if (compatibleTechs.length === 0) {
        const matchingRegionTechs = technicians.filter(
          (t) => t.region.trim().toLowerCase() === req.region.trim().toLowerCase()
        );
        let reason = `No technician found with required skill '${req.requiredSkill}' in '${req.region}' region.`;
        if (matchingRegionTechs.length === 0) {
          reason = `No active technicians operate in region '${req.region}'.`;
        }
        unassignedRequests.push({ requestId: req.id, reason });
        continue;
      }

      // Sort candidate technicians by least scheduled workload (Load Balancing)
      compatibleTechs.sort((a, b) => {
        const loadA = (techAssignmentsMap.get(a.id) || []).reduce(
          (sum, a) =>
            sum +
            (TimeUtils.parseTimeToMinutes(a.endTime) - TimeUtils.parseTimeToMinutes(a.startTime)),
          0
        );
        const loadB = (techAssignmentsMap.get(b.id) || []).reduce(
          (sum, b) =>
            sum +
            (TimeUtils.parseTimeToMinutes(b.endTime) - TimeUtils.parseTimeToMinutes(b.startTime)),
          0
        );
        return loadA - loadB;
      });

      let assigned = false;

      for (const tech of compatibleTechs) {
        const currentTechAssignments = techAssignmentsMap.get(tech.id) || [];
        const currentLoad = currentTechAssignments.reduce(
          (sum, a) =>
            sum +
            (TimeUtils.parseTimeToMinutes(a.endTime) - TimeUtils.parseTimeToMinutes(a.startTime)),
          0
        );

        if (currentLoad + reqDuration > tech.maxWorkloadMinutes) {
          continue; // Would exceed max workload
        }

        const techAvailStart = TimeUtils.parseTimeToMinutes(technicianAvailabilityStart(tech));
        const techAvailEnd = TimeUtils.parseTimeToMinutes(tech.availabilityEnd);

        // Calculate window overlap between tech availability and request preference
        const windowStart = Math.max(reqPrefStart, techAvailStart);
        const windowEnd = Math.min(reqPrefEnd, techAvailEnd);

        if (windowEnd - windowStart < reqDuration) {
          continue; // Window too narrow
        }

        // Search for a slot stepping in 15-minute increments
        for (let slotStart = windowStart; slotStart + reqDuration <= windowEnd; slotStart += 15) {
          const slotEnd = slotStart + reqDuration;

          // Check overlap with existing assignments for this technician
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
              source: 'DETERMINISTIC',
              status: 'SCHEDULED',
              reason: `${tech.name} has required skill '${req.requiredSkill}', works in '${req.region}', and is available from ${TimeUtils.minutesToTime(slotStart)} to ${TimeUtils.minutesToTime(slotEnd)}.`,
            };

            // Test full validation against single assignment rules
            const violations = ConstraintValidationService.validateSingleAssignment({
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
          reason: `Technicians with skill '${req.requiredSkill}' (${compatibleTechs.map((t) => t.name).join(', ')}) have scheduling conflicts or insufficient capacity during window ${req.preferredStartTime}-${req.preferredEndTime}.`,
        });
      }
    }

    // Tradeoffs explanation
    if (unassignedRequests.length > 0) {
      tradeoffs.push(
        `${unassignedRequests.length} request(s) left unassigned due to strict region, skill, or schedule window constraints.`
      );
    }
    if (trigger === 'EMERGENCY_REQUEST') {
      tradeoffs.push('Prioritized emergency request over lower priority non-emergency requests.');
    }
    if (trigger === 'TECHNICIAN_CANCELLATION') {
      tradeoffs.push('Reallocated affected requests to other qualified technicians in the same region.');
    }

    return {
      assignments: proposedAssignments,
      unassignedRequests,
      tradeoffs,
      questions,
    };
  }
}

function technicianAvailabilityStart(tech: Technician): string {
  return tech.availabilityStart;
}
