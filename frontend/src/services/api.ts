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

const API_BASE = '/api';

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
  getTechnicians: () => fetchJson<Technician[]>('/technicians'),
  createTechnician: (data: Partial<Technician>) =>
    fetchJson<Technician>('/technicians', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTechnician: (id: string, data: Partial<Technician>) =>
    fetchJson<Technician>(`/technicians/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  cancelTechnician: (id: string, actor = 'Dispatcher') =>
    fetchJson<{
      message: string;
      trigger: string;
      proposedPlan: ValidatedAiPlanResponse;
      diff: ScheduleDiff;
      context: any;
    }>(`/technicians/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    }),
  restoreTechnician: (id: string) =>
    fetchJson<Technician>(`/technicians/${id}/restore`, {
      method: 'POST',
    }),

  // Requests
  getRequests: () => fetchJson<ServiceRequest[]>('/requests'),
  createRequest: (data: Partial<ServiceRequest>) =>
    fetchJson<ServiceRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRequest: (id: string, data: Partial<ServiceRequest>) =>
    fetchJson<ServiceRequest>(`/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  createEmergencyRequest: (data: {
    title: string;
    description: string;
    region: string;
    requiredSkill: string;
    estimatedDurationMinutes: number;
    preferredStartTime: string;
    preferredEndTime: string;
    actor?: string;
  }) =>
    fetchJson<{
      message: string;
      trigger: string;
      proposedPlan: ValidatedAiPlanResponse;
      diff: ScheduleDiff;
      context: any;
    }>('/requests/emergency', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Schedules
  getCurrentSchedule: () =>
    fetchJson<{ currentSchedule: ScheduleVersion | null }>('/schedules/current'),
  getScheduleVersions: () => fetchJson<ScheduleVersion[]>('/schedules/versions'),
  getScheduleVersionById: (id: string) =>
    fetchJson<ScheduleVersion>(`/schedules/versions/${id}`),
  generatePlan: (trigger = 'INITIAL_PLAN', notes?: string) =>
    fetchJson<{
      proposal: ValidatedAiPlanResponse;
      diff: ScheduleDiff | null;
      baseScheduleVersionId: string | null;
    }>('/schedules/generate', {
      method: 'POST',
      body: JSON.stringify({ trigger, notes }),
    }),
  validateProposedSchedule: (proposedAssignments: ProposedAssignment[], baseScheduleVersionId?: string) =>
    fetchJson<ValidationResult>('/schedules/validate', {
      method: 'POST',
      body: JSON.stringify({ proposedAssignments, baseScheduleVersionId }),
    }),
  approveSchedule: (data: {
    proposedAssignments: ProposedAssignment[];
    trigger?: string;
    actor?: string;
    metadata?: any;
  }) =>
    fetchJson<{
      message: string;
      schedule: ScheduleVersion;
      notificationsCount: number;
    }>('/schedules/approve', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Assignments
  updateAssignment: (id: string, data: {
    technicianId?: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
    actor?: string;
  }) =>
    fetchJson<{ message: string; assignment: any }>(`/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  completeAssignment: (id: string, actor = 'Dispatcher') =>
    fetchJson<{ message: string; assignment: any }>(`/assignments/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    }),

  // Audit Logs & Notifications
  getAuditLogs: (limit = 100) => fetchJson<AuditLog[]>(`/audit-logs?limit=${limit}`),
  getNotifications: (limit = 100) =>
    fetchJson<NotificationItem[]>(`/notifications?limit=${limit}`),
  markNotificationsAsRead: () =>
    fetchJson<{ message: string }>('/notifications/mark-read', {
      method: 'POST',
    }),

  // System
  resetDemoDatabase: () =>
    fetchJson<{ message: string }>('/system/reset-demo', {
      method: 'POST',
    }),
};
