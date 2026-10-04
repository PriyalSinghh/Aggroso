import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { ReplanningService } from '../services/replanningService.js';
import { AuditService } from '../services/auditService.js';

export const requestRouter = Router();

// GET /api/requests
requestRouter.get('/', async (req: Request, res: Response) => {
  try {
    const requests = await prisma.serviceRequest.findMany({
      orderBy: { id: 'asc' },
    });

    // Get current approved schedule to attach active assignment details
    const currentSchedule = await prisma.scheduleVersion.findFirst({
      where: { status: 'APPROVED' },
      orderBy: { versionNumber: 'desc' },
      include: {
        assignments: {
          include: { technician: true },
        },
      },
    });

    const enriched = requests.map((item) => {
      const activeAssignment = currentSchedule?.assignments.find(
        (a) => a.requestId === item.id && a.status !== 'CANCELLED'
      );

      return {
        ...item,
        currentAssignment: activeAssignment
          ? {
              id: activeAssignment.id,
              technicianId: activeAssignment.technicianId,
              technicianName: activeAssignment.technician.name,
              startTime: activeAssignment.startTime,
              endTime: activeAssignment.endTime,
              status: activeAssignment.status,
              source: activeAssignment.source,
            }
          : null,
      };
    });

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch requests' });
  }
});

// POST /api/requests
requestRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      id,
      title,
      description,
      region,
      requiredSkill,
      priority = 'MEDIUM',
      estimatedDurationMinutes,
      preferredStartTime,
      preferredEndTime,
    } = req.body;

    let reqId = id;
    if (!reqId) {
      const count = await prisma.serviceRequest.count();
      reqId = `R${count + 1}`;
    }

    const created = await prisma.serviceRequest.create({
      data: {
        id: reqId,
        title,
        description: description || '',
        region,
        requiredSkill,
        priority,
        estimatedDurationMinutes: Number(estimatedDurationMinutes),
        preferredStartTime,
        preferredEndTime,
        status: 'UNASSIGNED',
        isEmergency: false,
      },
    });

    await AuditService.log({
      action: 'SERVICE_REQUEST_CREATED',
      entityType: 'SERVICE_REQUEST',
      entityId: created.id,
      newValue: created,
      reason: `Dispatcher created service ticket: ${title}`,
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create request' });
  }
});

// POST /api/requests/emergency
requestRouter.post('/emergency', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      region,
      requiredSkill,
      estimatedDurationMinutes,
      preferredStartTime,
      preferredEndTime,
      actor = 'Dispatcher',
    } = req.body;

    if (!title || !region || !requiredSkill || !estimatedDurationMinutes || !preferredStartTime || !preferredEndTime) {
      return res.status(400).json({ error: 'Missing required emergency request fields' });
    }

    const replanResult = await ReplanningService.addEmergencyRequestAndReplan({
      title,
      description: description || 'Critical emergency dispatched directly.',
      region,
      requiredSkill,
      estimatedDurationMinutes: Number(estimatedDurationMinutes),
      preferredStartTime,
      preferredEndTime,
      actor,
    });

    res.status(201).json({
      message: 'Emergency request created. Revised schedule proposal generated.',
      ...replanResult,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to handle emergency request' });
  }
});

// PATCH /api/requests/:id
requestRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prev = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!prev) {
      return res.status(404).json({ error: `Request ${id} not found` });
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: req.body,
    });

    await AuditService.log({
      action: 'SERVICE_REQUEST_UPDATED',
      entityType: 'SERVICE_REQUEST',
      entityId: id,
      previousValue: prev,
      newValue: updated,
      reason: `Updated details for request ${id}`,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update request' });
  }
});
