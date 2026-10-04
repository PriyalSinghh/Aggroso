import { prisma } from '../db/prisma.js';
import {
  AiPlanOutput,
  ProposedAssignment,
  ScheduleDiff,
} from '../types/index.js';
import { AiPlannerService, ValidatedAiPlanResponse } from './aiPlanner.js';
import { ScheduleDiffService } from './scheduleDiffService.js';
import { AuditService } from './auditService.js';

export interface ReplanResult {
  trigger: 'TECHNICIAN_CANCELLATION' | 'EMERGENCY_REQUEST' | 'MANUAL_REPLAN';
  baseScheduleVersionId?: string;
  proposedPlan: ValidatedAiPlanResponse;
  diff: ScheduleDiff;
  context: Record<string, any>;
}

export class ReplanningService {
  /**
   * Handles technician cancellation workflow
   */
  static async cancelTechnicianAndReplan(technicianId: string, actor = 'Dispatcher'): Promise<ReplanResult> {
    const technician = await prisma.technician.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      throw new Error(`Technician with ID '${technicianId}' not found.`);
    }

    // 1. Mark technician cancelled in DB
    const updatedTech = await prisma.technician.update({
      where: { id: technicianId },
      data: { status: 'CANCELLED' },
    });

    // 2. Audit log for technician cancellation
    await AuditService.log({
      action: 'TECHNICIAN_CANCELLED',
      entityType: 'TECHNICIAN',
      entityId: technicianId,
      previousValue: { status: technician.status },
      newValue: { status: 'CANCELLED' },
      reason: `Technician ${technician.name} reported unexpected unavailability/sick leave.`,
      actor,
    });

    // 3. Find current approved schedule
    const currentSchedule = await prisma.scheduleVersion.findFirst({
      where: { status: 'APPROVED' },
      orderBy: { versionNumber: 'desc' },
      include: {
        assignments: {
          include: {
            serviceRequest: true,
            technician: true,
          },
        },
      },
    });

    const affectedAssignments = currentSchedule?.assignments.filter(
      (a) => a.technicianId === technicianId && a.status !== 'COMPLETED'
    ) || [];

    // 4. Generate validated plan for replanning
    const proposedPlan = await AiPlannerService.generateValidatedPlan({
      trigger: 'TECHNICIAN_CANCELLATION',
      notes: `Technician ${technician.name} cancelled. Reallocate active assignments (${affectedAssignments.map((a) => a.requestId).join(', ')}).`,
      baseScheduleVersionId: currentSchedule?.id,
    });

    // 5. Compute diff
    const allRequests = await prisma.serviceRequest.findMany();
    const allTechnicians = await prisma.technician.findMany();

    const diff = ScheduleDiffService.computeDiff({
      previousAssignments: currentSchedule?.assignments || [],
      newAssignments: proposedPlan.assignments,
      unassignedRequests: proposedPlan.unassignedRequests,
      requests: allRequests,
      technicians: allTechnicians,
      tradeoffs: proposedPlan.tradeoffs,
    });

    return {
      trigger: 'TECHNICIAN_CANCELLATION',
      baseScheduleVersionId: currentSchedule?.id,
      proposedPlan,
      diff,
      context: {
        cancelledTechnician: updatedTech,
        affectedCount: affectedAssignments.length,
        affectedRequestIds: affectedAssignments.map((a) => a.requestId),
      },
    };
  }

  /**
   * Handles emergency service request creation and replanning
   */
  static async addEmergencyRequestAndReplan(params: {
    title: string;
    description: string;
    region: string;
    requiredSkill: string;
    estimatedDurationMinutes: number;
    preferredStartTime: string;
    preferredEndTime: string;
    actor?: string;
  }): Promise<ReplanResult> {
    const {
      title,
      description,
      region,
      requiredSkill,
      estimatedDurationMinutes,
      preferredStartTime,
      preferredEndTime,
      actor = 'Dispatcher',
    } = params;

    // 1. Generate new request ID (e.g. R-EMERGENCY-<timestamp> or R11, etc.)
    const count = await prisma.serviceRequest.count();
    const requestId = `R-EMG-${count + 1}`;

    const newRequest = await prisma.serviceRequest.create({
      data: {
        id: requestId,
        title,
        description,
        region,
        requiredSkill,
        priority: 'CRITICAL',
        estimatedDurationMinutes,
        preferredStartTime,
        preferredEndTime,
        status: 'UNASSIGNED',
        isEmergency: true,
      },
    });

    // 2. Audit log
    await AuditService.log({
      action: 'EMERGENCY_REQUEST_CREATED',
      entityType: 'SERVICE_REQUEST',
      entityId: newRequest.id,
      newValue: newRequest,
      reason: `Critical emergency ticket created: ${title}`,
      actor,
    });

    // 3. Find current approved schedule
    const currentSchedule = await prisma.scheduleVersion.findFirst({
      where: { status: 'APPROVED' },
      orderBy: { versionNumber: 'desc' },
      include: {
        assignments: true,
      },
    });

    // 4. Generate plan
    const proposedPlan = await AiPlannerService.generateValidatedPlan({
      trigger: 'EMERGENCY_REQUEST',
      notes: `Urgent emergency service request ${newRequest.id} added. Priority is CRITICAL.`,
      baseScheduleVersionId: currentSchedule?.id,
    });

    // 5. Compute diff
    const allRequests = await prisma.serviceRequest.findMany();
    const allTechnicians = await prisma.technician.findMany();

    const diff = ScheduleDiffService.computeDiff({
      previousAssignments: currentSchedule?.assignments || [],
      newAssignments: proposedPlan.assignments,
      unassignedRequests: proposedPlan.unassignedRequests,
      requests: allRequests,
      technicians: allTechnicians,
      tradeoffs: proposedPlan.tradeoffs,
    });

    return {
      trigger: 'EMERGENCY_REQUEST',
      baseScheduleVersionId: currentSchedule?.id,
      proposedPlan,
      diff,
      context: {
        emergencyRequest: newRequest,
      },
    };
  }
}
