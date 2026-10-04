import { prisma } from '../db/prisma.js';

export interface CreateAuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: any;
  newValue?: any;
  reason?: string;
  actor?: string;
}

export class AuditService {
  static async log(params: CreateAuditLogParams) {
    const { action, entityType, entityId, previousValue, newValue, reason, actor = 'Dispatcher' } = params;

    return prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        previousValue: previousValue ? JSON.stringify(previousValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        reason,
        actor,
      },
    });
  }

  static async getLogs(limit = 100) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
