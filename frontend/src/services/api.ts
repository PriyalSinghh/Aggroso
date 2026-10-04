import {
  Technician,
  ServiceRequest,
  ScheduleVersion,
  ValidatedAiPlanResponse,
  ScheduleDiff,
  ValidationResult,
  AuditLog,
  NotificationItem,
  ProposedAssignment,
} from '../types';
import { ClientStore, ClientConstraintEngine } from './clientEngine';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: `Request failed with status ${response.status}` };
    }
    const error: any = new Error(errorData.error || `HTTP Error ${response.status}`);
    error.status = response.status;
    error.violations = errorData.violations;
    throw error;
  }

  return response.json();
}

export const api = {
  // Technicians
  getTechnicians: async (): Promise<Technician[]> => {
    try {
      return await fetchJson<Technician[]>('/technicians');
    } catch (err) {
      return ClientStore.getTechnicians();
    }
  },

  createTechnician: async (data: Partial<Technician>): Promise<Technician> => {
    try {
      return await fetchJson<Technician>('/technicians', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      throw err;
    }
  },

  updateTechnician: async (id: string, data: Partial<Technician>): Promise<Technician> => {
    try {
      return await fetchJson<Technician>(`/technicians/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (err) {
      throw err;
    }
  },

  cancelTechnician: async (id: string, actor = 'Dispatcher') => {
    try {
      return await fetchJson<{
        message: string;
        trigger: string;
        proposedPlan: ValidatedAiPlanResponse;
        diff: ScheduleDiff;
        context: any;
      }>(`/technicians/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ actor }),
      });
    } catch (err) {
      return ClientStore.cancelTechnicianAndReplan(id, actor);
    }
  },

  restoreTechnician: async (id: string) => {
    try {
      return await fetchJson<Technician>(`/technicians/${id}/restore`, {
        method: 'POST',
      });
    } catch (err) {
      return ClientStore.restoreTechnician(id);
    }
  },

  // Requests
  getRequests: async (): Promise<ServiceRequest[]> => {
    try {
      return await fetchJson<ServiceRequest[]>('/requests');
    } catch (err) {
      return ClientStore.getRequests();
    }
  },

  createRequest: async (data: Partial<ServiceRequest>): Promise<ServiceRequest> => {
    try {
      return await fetchJson<ServiceRequest>('/requests', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      throw err;
    }
  },

  updateRequest: async (id: string, data: Partial<ServiceRequest>): Promise<ServiceRequest> => {
    try {
      return await fetchJson<ServiceRequest>(`/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (err) {
      throw err;
    }
  },

  createEmergencyRequest: async (data: {
    title: string;
    description: string;
    region: string;
    requiredSkill: string;
    estimatedDurationMinutes: number;
    preferredStartTime: string;
    preferredEndTime: string;
    actor?: string;
  }) => {
    try {
      return await fetchJson<{
        message: string;
        trigger: string;
        proposedPlan: ValidatedAiPlanResponse;
        diff: ScheduleDiff;
        context: any;
      }>('/requests/emergency', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      return ClientStore.addEmergencyRequestAndReplan(data);
    }
  },

  // Schedules
  getCurrentSchedule: async (): Promise<{ currentSchedule: ScheduleVersion | null }> => {
    try {
      return await fetchJson<{ currentSchedule: ScheduleVersion | null }>('/schedules/current');
    } catch (err) {
      return { currentSchedule: ClientStore.getCurrentSchedule() };
    }
  },

  getScheduleVersions: async (): Promise<ScheduleVersion[]> => {
    try {
      return await fetchJson<ScheduleVersion[]>('/schedules/versions');
    } catch (err) {
      return ClientStore.getScheduleVersions();
    }
  },

  getScheduleVersionById: async (id: string): Promise<ScheduleVersion> => {
    try {
      return await fetchJson<ScheduleVersion>(`/schedules/versions/${id}`);
    } catch (err) {
      const v = ClientStore.getScheduleVersions().find((item) => item.id === id);
      if (!v) throw new Error('Schedule version not found');
      return v;
    }
  },

  generatePlan: async (trigger = 'INITIAL_PLAN', notes?: string) => {
    try {
      return await fetchJson<{
        proposal: ValidatedAiPlanResponse;
        diff: ScheduleDiff | null;
        baseScheduleVersionId: string | null;
      }>('/schedules/generate', {
        method: 'POST',
        body: JSON.stringify({ trigger, notes }),
      });
    } catch (err) {
      return ClientStore.generatePlan(trigger, notes);
    }
  },

  validateProposedSchedule: async (
    proposedAssignments: ProposedAssignment[],
    baseScheduleVersionId?: string
  ): Promise<ValidationResult> => {
    try {
      return await fetchJson<ValidationResult>('/schedules/validate', {
        method: 'POST',
        body: JSON.stringify({ proposedAssignments, baseScheduleVersionId }),
      });
    } catch (err) {
      const techs = ClientStore.getTechnicians();
      const reqs = ClientStore.getRequests();
      return ClientConstraintEngine.validateSchedule({ proposedAssignments, technicians: techs, requests: reqs });
    }
  },

  approveSchedule: async (data: {
    proposedAssignments: ProposedAssignment[];
    trigger?: string;
    actor?: string;
    metadata?: any;
  }) => {
    try {
      return await fetchJson<{
        message: string;
        schedule: ScheduleVersion;
        notificationsCount: number;
      }>('/schedules/approve', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (err.violations) throw err;
      return ClientStore.approveSchedule(data);
    }
  },

  // Assignments
  updateAssignment: async (
    id: string,
    data: {
      technicianId?: string;
      startTime?: string;
      endTime?: string;
      reason?: string;
      actor?: string;
    }
  ) => {
    try {
      return await fetchJson<{ message: string; assignment: any }>(`/assignments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (err.violations) throw err;
      return ClientStore.updateAssignment(id, data);
    }
  },

  completeAssignment: async (id: string, actor = 'Dispatcher') => {
    try {
      return await fetchJson<{ message: string; assignment: any }>(`/assignments/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ actor }),
      });
    } catch (err) {
      return ClientStore.completeAssignment(id, actor);
    }
  },

  // Audit Logs & Notifications
  getAuditLogs: async (limit = 100): Promise<AuditLog[]> => {
    try {
      return await fetchJson<AuditLog[]>(`/audit-logs?limit=${limit}`);
    } catch (err) {
      return ClientStore.getAuditLogs().slice(0, limit);
    }
  },

  getNotifications: async (limit = 100): Promise<NotificationItem[]> => {
    try {
      return await fetchJson<NotificationItem[]>(`/notifications?limit=${limit}`);
    } catch (err) {
      return ClientStore.getNotifications().slice(0, limit);
    }
  },

  markNotificationsAsRead: async () => {
    try {
      return await fetchJson<{ message: string }>('/notifications/mark-read', {
        method: 'POST',
      });
    } catch (err) {
      return ClientStore.markNotificationsAsRead();
    }
  },

  // System
  resetDemoDatabase: async () => {
    try {
      return await fetchJson<{ message: string }>('/system/reset-demo', {
        method: 'POST',
      });
    } catch (err) {
      return ClientStore.resetDemo();
    }
  },
};
