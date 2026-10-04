import { prisma } from '../db/prisma.js';
import {
  AiPlanOutput,
  ProposedAssignment,
  ValidationResult,
  Violation,
} from '../types/index.js';
import { aiService } from './aiService.js';
import { ConstraintValidationService } from './constraintEngine.js';

export interface ValidatedAiPlanResponse extends AiPlanOutput {
  validationSummary: {
    isValid: boolean;
    totalProposed: number;
    validCount: number;
    invalidCount: number;
    violations: Violation[];
  };
}

export class AiPlannerService {
  /**
   * Generates a proposal using AI and strictly validates every single proposal deterministically.
   */
  static async generateValidatedPlan(params: {
    trigger: string;
    notes?: string;
    baseScheduleVersionId?: string;
  }): Promise<ValidatedAiPlanResponse> {
    const { trigger, notes, baseScheduleVersionId } = params;

    // Fetch technicians and service requests
    const technicians = await prisma.technician.findMany();
    const requests = await prisma.serviceRequest.findMany();

    // Fetch existing completed assignments if there's a base schedule
    let completedAssignments: any[] = [];
    if (baseScheduleVersionId) {
      completedAssignments = await prisma.assignment.findMany({
        where: {
          scheduleVersionId: baseScheduleVersionId,
          status: 'COMPLETED',
        },
      });
    }

    // Call AI provider
    const rawAiOutput = await aiService.generatePlan({
      technicians,
      requests,
      completedAssignments,
      trigger,
      notes,
    });

    // 1. Run holistic schedule validation
    const overallValidation = ConstraintValidationService.validateSchedule({
      proposedAssignments: rawAiOutput.assignments,
      technicians,
      requests,
      baseCompletedAssignments: completedAssignments,
    });

    // 2. Validate individual assignments and annotate them
    const techMap = new Map(technicians.map((t) => [t.id, t]));
    const reqMap = new Map(requests.map((r) => [r.id, r]));

    const annotatedAssignments: ProposedAssignment[] = rawAiOutput.assignments.map((assignment) => {
      const tech = techMap.get(assignment.technicianId);
      const req = reqMap.get(assignment.requestId);

      let assignmentViolations: Violation[] = [];

      if (!tech || !req) {
        assignmentViolations.push({
          code: 'UNKNOWN_ENTITY',
          requestId: assignment.requestId,
          technicianId: assignment.technicianId,
          message: `Technician (${assignment.technicianId}) or Request (${assignment.requestId}) not recognized.`,
        });
      } else {
        assignmentViolations = ConstraintValidationService.validateSingleAssignment({
          assignment,
          technician: tech,
          request: req,
        });
      }

      // Also attach any double booking or workload violations relating to this assignment
      const relatedCrossViolations = overallValidation.violations.filter(
        (v) =>
          v.technicianId === assignment.technicianId &&
          (v.code === 'DOUBLE_BOOKING' || v.code === 'WORKLOAD_EXCEEDED')
      );

      const allItemViolations = [...assignmentViolations, ...relatedCrossViolations];

      return {
        ...assignment,
        isValid: allItemViolations.length === 0,
        violations: allItemViolations,
      };
    });

    const validCount = annotatedAssignments.filter((a) => a.isValid).length;
    const invalidCount = annotatedAssignments.filter((a) => !a.isValid).length;

    return {
      assignments: annotatedAssignments,
      unassignedRequests: rawAiOutput.unassignedRequests,
      tradeoffs: rawAiOutput.tradeoffs,
      questions: rawAiOutput.questions,
      validationSummary: {
        isValid: overallValidation.valid,
        totalProposed: annotatedAssignments.length,
        validCount,
        invalidCount,
        violations: overallValidation.violations,
      },
    };
  }
}
