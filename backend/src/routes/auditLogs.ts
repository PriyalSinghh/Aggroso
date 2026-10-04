import { Router, Request, Response } from 'express';
import { AuditService } from '../services/auditService.js';

export const auditLogRouter = Router();

// GET /api/audit-logs
auditLogRouter.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const logs = await AuditService.getLogs(limit);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
  }
});
