import { prisma } from '../db/prisma.js';
import { Assignment, ServiceRequest, Technician } from '@prisma/client';

export class NotificationService {
  /**
   * Generates mock notifications for technicians and customers upon schedule approval.
   */
  static async createScheduleApprovalNotifications(params: {
    scheduleVersionNumber: number;
    assignments: (Assignment & {
      technician?: Technician;
      serviceRequest?: ServiceRequest;
    })[];
  }) {
    const { scheduleVersionNumber, assignments } = params;
    const notifications = [];

    for (const a of assignments) {
      const techName = a.technician?.name || a.technicianId;
      const reqTitle = a.serviceRequest?.title || a.requestId;

      // 1. Notification to Technician
      const techNotification = await prisma.notification.create({
        data: {
          assignmentId: a.id,
          recipientType: 'TECHNICIAN',
          recipientId: a.technicianId,
          message: `New Assignment Confirmed: Job ${a.requestId} ("${reqTitle}") scheduled for ${a.startTime}–${a.endTime} (Schedule v${scheduleVersionNumber}).`,
          status: 'SENT',
        },
      });
      notifications.push(techNotification);

      // 2. Notification to Dispatch / Customer
      const customerNotification = await prisma.notification.create({
        data: {
          assignmentId: a.id,
          recipientType: 'CUSTOMER',
          recipientId: `REQ-${a.requestId}`,
          message: `Your service visit for "${reqTitle}" has been confirmed with technician ${techName} for ${a.startTime}–${a.endTime}.`,
          status: 'SENT',
        },
      });
      notifications.push(customerNotification);
    }

    return notifications;
  }

  static async getNotifications(limit = 100) {
    return prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
