import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { AiPlannerService } from '../services/aiPlanner.js';
import { ConstraintValidationService } from '../services/constraintEngine.js';
import { AuditService } from '../services/auditService.js';
import { NotificationService } from '../services/notificationService.js';
import { ScheduleDiffService } from '../services/scheduleDiffService.js';
import { ProposedAssignment } from '../types/index.js';

export const scheduleRouter = Router();

// GET /api/schedules/current
scheduleRouter.get('/current', async (req: Request, res: Response) => {
  try {
    const currentSchedule = await prisma.scheduleVersion.findFirst({
      where: { status: 'APPROVED' },
      orderBy: { versionNumber: 'desc' },
      include: {
        assignments: {
          include: {
            technician: true,
            serviceRequest: true,
          },
        },
      },
    });

    if (!currentSchedule) {
      return res.json({ currentSchedule: null });
    }

    let parsedMetadata = null;
    if (currentSchedule.metadata) {
      try {
        parsedMetadata = JSON.parse(currentSchedule.metadata);
      } catch (e) {}
    }

    res.json({
      currentSchedule: {
        ...currentSchedule,
        metadata: parsedMetadata,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch current schedule' });
  }
});

// GET /api/schedules/versions
scheduleRouter.get('/versions', async (req: Request, res: Response) => {
  try {
    const versions = await prisma.scheduleVersion.findMany({
      orderBy: { versionNumber: 'desc' },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });

    res.json(versions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch schedule versions' });
  }
});

// GET /api/schedules/versions/:id
scheduleRouter.get('/versions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const version = await prisma.scheduleVersion.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            technician: true,
            serviceRequest: true,
          },
        },
      },
    });

    if (!version) {
      return res.status(404).json({ error: `Schedule version ${id} not found` });
    }

    let parsedMetadata = null;
    if (version.metadata) {
      try {
        parsedMetadata = JSON.parse(version.metadata);
      } catch (e) {}
    }

    res.json({
      ...version,
      metadata: parsedMetadata,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch schedule version' });
  }
});

// POST /api/schedules/generate
scheduleRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const { trigger = 'INITIAL_PLAN', notes } = req.body;

    const currentSchedule = await prisma.scheduleVersion.findFirst({
      where: { status: 'APPROVED' },
      orderBy: { versionNumber: 'desc' },
    });

    const proposal = await AiPlannerService.generateValidatedPlan({
      trigger,
      notes,
      baseScheduleVersionId: currentSchedule?.id,
    });

    // If there's an existing approved schedule, calculate diff
    let diff = null;
    if (currentSchedule) {
      const prevAssignments = await prisma.assignment.findMany({
        where: { scheduleVersionId: currentSchedule.id },
      });
      const allRequests = await prisma.serviceRequest.findMany();
      const allTechnicians = await prisma.technician.findMany();

      diff = ScheduleDiffService.computeDiff({
        previousAssignments: prevAssignments,
        newAssignments: proposal.assignments,
        unassignedRequests: proposal.unassignedRequests,
        requests: allRequests,
        technicians: allTechnicians,
        tradeoffs: proposal.tradeoffs,
      });
    }

    res.json({
      proposal,
      diff,
      baseScheduleVersionId: currentSchedule?.id || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate dispatch plan' });
  }
});

// POST /api/schedules/validate
scheduleRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const { proposedAssignments, baseScheduleVersionId } = req.body;
    if (!Array.isArray(proposedAssignments)) {
      return res.status(400).json({ error: 'proposedAssignments must be an array' });
    }

    const technicians = await prisma.technician.findMany();
    const requests = await prisma.serviceRequest.findMany();

    let completedAssignments: any[] = [];
    if (baseScheduleVersionId) {
      completedAssignments = await prisma.assignment.findMany({
        where: {
          scheduleVersionId: baseScheduleVersionId,
          status: 'COMPLETED',
        },
      });
    }

    const validation = ConstraintValidationService.validateSchedule({
      proposedAssignments,
      technicians,
      requests,
      baseCompletedAssignments: completedAssignments,
    });

    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to validate schedule' });
  }
});

// POST /api/schedules/approve
scheduleRouter.post('/approve', async (req: Request, res: Response) => {
  try {
    const {
      proposedAssignments,
      trigger = 'INITIAL_PLAN',
      actor = 'Dispatcher',
      metadata,
    } = req.body;

    if (!Array.isArray(proposedAssignments) || proposedAssignments.length === 0) {
      return res.status(400).json({ error: 'Cannot approve an empty schedule' });
    }

    const technicians = await prisma.technician.findMany();
    const requests = await prisma.serviceRequest.findMany();

    // Check last approved schedule
    const lastApproved = await prisma.scheduleVersion.findFirst({
      where: { status: 'APPROVED' },
      orderBy: { versionNumber: 'desc' },
      include: { assignments: true },
    });

    const completedAssignments = lastApproved?.assignments.filter((a) => a.status === 'COMPLETED') || [];

    // 1. Mandatory Deterministic Constraint Verification Before Approval
    const validation = ConstraintValidationService.validateSchedule({
      proposedAssignments,
      technicians,
      requests,
      baseCompletedAssignments: completedAssignments,
    });

    if (!validation.valid) {
      return res.status(422).json({
        error: 'Schedule failed deterministic constraint validation. Cannot approve.',
        violations: validation.violations,
      });
    }

    // 2. Mark previous approved version as SUPERSEDED
    if (lastApproved) {
      await prisma.scheduleVersion.update({
        where: { id: lastApproved.id },
        data: { status: 'SUPERSEDED' },
      });
    }

    const nextVersionNumber = (lastApproved?.versionNumber || 0) + 1;

    // 3. Create new ScheduleVersion
    const newSchedule = await prisma.scheduleVersion.create({
      data: {
        versionNumber: nextVersionNumber,
        status: 'APPROVED',
        trigger,
        createdBy: actor,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    // 4. Create new Assignments
    const createdAssignments = [];
    for (const item of proposedAssignments as ProposedAssignment[]) {
      const assignment = await prisma.assignment.create({
        data: {
          scheduleVersionId: newSchedule.id,
          requestId: item.requestId,
          technicianId: item.technicianId,
          startTime: item.startTime,
          endTime: item.endTime,
          status: item.status || 'SCHEDULED',
          source: item.source || 'AI',
          reasoning: item.reason || null,
        },
        include: {
          technician: true,
          serviceRequest: true,
        },
      });
      createdAssignments.push(assignment);

      // Update ServiceRequest status to ASSIGNED (or preserve COMPLETED)
      const currentReq = requests.find((r) => r.id === item.requestId);
      if (currentReq && currentReq.status !== 'COMPLETED') {
        await prisma.serviceRequest.update({
          where: { id: item.requestId },
          data: { status: 'ASSIGNED' },
        });
      }
    }

    // Update unassigned requests back to UNASSIGNED if they were orphaned
    const assignedReqIds = new Set(proposedAssignments.map((a: ProposedAssignment) => a.requestId));
    for (const reqItem of requests) {
      if (!assignedReqIds.has(reqItem.id) && reqItem.status === 'ASSIGNED') {
        await prisma.serviceRequest.update({
          where: { id: reqItem.id },
          data: { status: 'UNASSIGNED' },
        });
      }
    }

    // 5. Create Audit Log
    await AuditService.log({
      action: 'SCHEDULE_APPROVED',
      entityType: 'SCHEDULE_VERSION',
      entityId: newSchedule.id,
      newValue: {
        versionNumber: newSchedule.versionNumber,
        assignmentsCount: createdAssignments.length,
        trigger,
      },
      reason: `Schedule Version ${newSchedule.versionNumber} approved by ${actor} (Trigger: ${trigger}).`,
      actor,
    });

    // 6. Generate Mock Notifications
    const notifications = await NotificationService.createScheduleApprovalNotifications({
      scheduleVersionNumber: newSchedule.versionNumber,
      assignments: createdAssignments,
    });

    res.status(201).json({
      message: `Schedule Version ${newSchedule.versionNumber} approved and confirmed successfully.`,
      schedule: {
        ...newSchedule,
        assignments: createdAssignments,
      },
      notificationsCount: notifications.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to approve schedule' });
  }
});
