import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { ReplanningService } from '../services/replanningService.js';
import { AuditService } from '../services/auditService.js';
import { TimeUtils } from '../services/constraintEngine.js';

export const technicianRouter = Router();

// GET /api/technicians
technicianRouter.get('/', async (req: Request, res: Response) => {
  try {
    const technicians = await prisma.technician.findMany({
      orderBy: { id: 'asc' },
    });

    // Get current approved schedule to compute current workload
    const currentSchedule = await prisma.scheduleVersion.findFirst({
      where: { status: 'APPROVED' },
      orderBy: { versionNumber: 'desc' },
      include: {
        assignments: {
          where: { status: { in: ['SCHEDULED', 'COMPLETED', 'IN_PROGRESS'] } },
        },
      },
    });

    const enriched = technicians.map((tech) => {
      const assignments = currentSchedule?.assignments.filter((a) => a.technicianId === tech.id) || [];
      const currentWorkloadMinutes = assignments.reduce((sum, a) => {
        const start = TimeUtils.parseTimeToMinutes(a.startTime);
        const end = TimeUtils.parseTimeToMinutes(a.endTime);
        return sum + (end > start ? end - start : 0);
      }, 0);

      return {
        ...tech,
        skillsList: tech.skills.split(',').map((s) => s.trim()),
        currentWorkloadMinutes,
        assignedJobsCount: assignments.length,
      };
    });

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch technicians' });
  }
});

// POST /api/technicians
technicianRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, skills, region, availabilityStart, availabilityEnd, maxWorkloadMinutes } = req.body;
    if (!id || !name || !skills || !region || !availabilityStart || !availabilityEnd) {
      return res.status(400).json({ error: 'Missing required technician fields' });
    }

    const tech = await prisma.technician.create({
      data: {
        id,
        name,
        skills: Array.isArray(skills) ? skills.join(',') : skills,
        region,
        availabilityStart,
        availabilityEnd,
        maxWorkloadMinutes: maxWorkloadMinutes || 480,
        status: 'AVAILABLE',
      },
    });

    await AuditService.log({
      action: 'TECHNICIAN_CREATED',
      entityType: 'TECHNICIAN',
      entityId: tech.id,
      newValue: tech,
      reason: `Added new technician ${tech.name}`,
    });

    res.status(201).json(tech);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create technician' });
  }
});

// PATCH /api/technicians/:id
technicianRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prev = await prisma.technician.findUnique({ where: { id } });
    if (!prev) {
      return res.status(400).json({ error: `Technician ${id} not found` });
    }

    const updated = await prisma.technician.update({
      where: { id },
      data: req.body,
    });

    await AuditService.log({
      action: 'TECHNICIAN_UPDATED',
      entityType: 'TECHNICIAN',
      entityId: id,
      previousValue: prev,
      newValue: updated,
      reason: `Updated details for ${updated.name}`,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update technician' });
  }
});

// POST /api/technicians/:id/cancel
technicianRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = req.body.actor || 'Dispatcher';

    const replanResult = await ReplanningService.cancelTechnicianAndReplan(id, actor);
    res.json({
      message: `Technician ${id} marked CANCELLED. Replanning proposal generated.`,
      ...replanResult,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to cancel technician and replan' });
  }
});

// POST /api/technicians/:id/restore
technicianRouter.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await prisma.technician.update({
      where: { id },
      data: { status: 'AVAILABLE' },
    });

    await AuditService.log({
      action: 'TECHNICIAN_RESTORED',
      entityType: 'TECHNICIAN',
      entityId: id,
      newValue: { status: 'AVAILABLE' },
      reason: `Technician ${updated.name} restored to AVAILABLE status.`,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to restore technician' });
  }
});
