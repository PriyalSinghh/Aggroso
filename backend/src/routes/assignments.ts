import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { ConstraintValidationService } from '../services/constraintEngine.js';
import { AuditService } from '../services/auditService.js';
import { ProposedAssignment } from '../types/index.js';

export const assignmentRouter = Router();

// PATCH /api/assignments/:id
assignmentRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { technicianId, startTime, endTime, actor = 'Dispatcher', reason } = req.body;

    const currentAssignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        scheduleVersion: true,
        serviceRequest: true,
        technician: true,
      },
    });

    if (!currentAssignment) {
      return res.status(404).json({ error: `Assignment ${id} not found` });
    }

    if (currentAssignment.status === 'COMPLETED') {
      return res.status(422).json({
        error: 'Completed assignments cannot be modified.',
        violations: [
          {
            code: 'COMPLETED_ASSIGNMENT_MODIFIED',
            requestId: currentAssignment.requestId,
            technicianId: currentAssignment.technicianId,
            message: 'Completed jobs are locked and cannot be edited.',
          },
        ],
      });
    }

    // Prepare hypothetical new schedule version assignments for validation
    const siblings = await prisma.assignment.findMany({
      where: {
        scheduleVersionId: currentAssignment.scheduleVersionId,
        id: { not: id },
      },
    });

    const targetTechId = technicianId || currentAssignment.technicianId;
    const targetStartTime = startTime || currentAssignment.startTime;
    const targetEndTime = endTime || currentAssignment.endTime;

    const candidateAssignment: ProposedAssignment = {
      requestId: currentAssignment.requestId,
      technicianId: targetTechId,
      startTime: targetStartTime,
      endTime: targetEndTime,
      status: currentAssignment.status as any,
      source: 'MANUAL',
    };

    const hypotheticalSchedule: ProposedAssignment[] = [
      ...siblings.map((s) => ({
        requestId: s.requestId,
        technicianId: s.technicianId,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status as any,
        source: s.source as any,
      })),
      candidateAssignment,
    ];

    const technicians = await prisma.technician.findMany();
    const requests = await prisma.serviceRequest.findMany();

    const validation = ConstraintValidationService.validateSchedule({
      proposedAssignments: hypotheticalSchedule,
      technicians,
      requests,
    });

    if (!validation.valid) {
      return res.status(422).json({
        error: 'Manual assignment update violates scheduling constraints.',
        violations: validation.violations,
      });
    }

    // Update assignment in database
    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        technicianId: targetTechId,
        startTime: targetStartTime,
        endTime: targetEndTime,
        source: 'MANUAL',
        reasoning: reason || `Manual dispatcher override by ${actor}`,
      },
      include: {
        technician: true,
        serviceRequest: true,
      },
    });

    // Record Audit Log
    await AuditService.log({
      action: 'MANUAL_ASSIGNMENT_OVERRIDE',
      entityType: 'ASSIGNMENT',
      entityId: id,
      previousValue: {
        technicianId: currentAssignment.technicianId,
        startTime: currentAssignment.startTime,
        endTime: currentAssignment.endTime,
      },
      newValue: {
        technicianId: targetTechId,
        startTime: targetStartTime,
        endTime: targetEndTime,
      },
      reason: reason || `Dispatcher manual adjustment on ticket ${currentAssignment.requestId}`,
      actor,
    });

    res.json({
      message: 'Assignment successfully updated and validated.',
      assignment: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update assignment' });
  }
});

// POST /api/assignments/:id/complete
assignmentRouter.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actor = 'Dispatcher' } = req.body;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { serviceRequest: true },
    });

    if (!assignment) {
      return res.status(404).json({ error: `Assignment ${id} not found` });
    }

    const updatedAssignment = await prisma.assignment.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    await prisma.serviceRequest.update({
      where: { id: assignment.requestId },
      data: { status: 'COMPLETED' },
    });

    await AuditService.log({
      action: 'ASSIGNMENT_COMPLETED',
      entityType: 'ASSIGNMENT',
      entityId: id,
      previousValue: { status: assignment.status },
      newValue: { status: 'COMPLETED' },
      reason: `Field work for request ${assignment.requestId} completed successfully.`,
      actor,
    });

    res.json({
      message: `Assignment ${id} marked COMPLETED.`,
      assignment: updatedAssignment,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to complete assignment' });
  }
});
