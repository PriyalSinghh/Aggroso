import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notificationService.js';
import { prisma } from '../db/prisma.js';

export const notificationRouter = Router();

// GET /api/notifications
notificationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const notifications = await NotificationService.getNotifications(limit);
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/mark-read
notificationRouter.post('/mark-read', async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { status: 'SENT' },
      data: { status: 'READ' },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update notifications' });
  }
});
