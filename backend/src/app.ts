import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { technicianRouter } from './routes/technicians.js';
import { requestRouter } from './routes/requests.js';
import { scheduleRouter } from './routes/schedules.js';
import { assignmentRouter } from './routes/assignments.js';
import { auditLogRouter } from './routes/auditLogs.js';
import { notificationRouter } from './routes/notifications.js';
import { systemRouter } from './routes/system.js';

export const app = express();

app.use(cors());
app.use(express.json());

// API health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Field Service Dispatch and Replanning Engine',
  });
});

// Routes
app.use('/api/technicians', technicianRouter);
app.use('/api/requests', requestRouter);
app.use('/api/schedules', scheduleRouter);
app.use('/api/assignments', assignmentRouter);
app.use('/api/audit-logs', auditLogRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/system', systemRouter);

import path from 'path';
import fs from 'fs';

// Serve frontend static build in production if present
const frontendDistPath = path.resolve(process.cwd(), '../frontend/dist');
const localFrontendDistPath = path.resolve(process.cwd(), './frontend-dist');

const activeDistPath = fs.existsSync(frontendDistPath)
  ? frontendDistPath
  : fs.existsSync(localFrontendDistPath)
  ? localFrontendDistPath
  : null;

if (activeDistPath) {
  app.use(express.static(activeDistPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(activeDistPath, 'index.html'));
  });
}

// Central error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
  });
});
