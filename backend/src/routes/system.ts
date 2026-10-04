import { Router, Request, Response } from 'express';
import { runDatabaseSeed } from '../services/seedService.js';

export const systemRouter = Router();

// POST /api/system/reset-demo
systemRouter.post('/reset-demo', async (req: Request, res: Response) => {
  try {
    await runDatabaseSeed();
    res.json({ message: 'Demo database reset to initial seeded state successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset demo database' });
  }
});
