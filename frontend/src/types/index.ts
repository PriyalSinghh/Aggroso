export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TechnicianStatus = 'AVAILABLE' | 'CANCELLED';
export type RequestStatus = 'UNASSIGNED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
export type AssignmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'IN_PROGRESS';
export type ScheduleStatus = 'DRAFT' | 'APPROVED' | 'SUPERSEDED';
export type AssignmentSource = 'AI' | 'MANUAL' | 'DETERMINISTIC';
export type ScheduleTrigger =
  | 'INITIAL_PLAN'
  | 'TECHNICIAN_CANCELLATION'
  | 'EMERGENCY_REQUEST'
  | 'MANUAL_EDIT'
  | 'REPLAN';

export interface Technician {
  id: string;
  name: string;
  skills: string;
  skillsList?: string[];
  region: string;
  availabilityStart: string;
  availabilityEnd: string;
  maxWorkloadMinutes: number;
  status: TechnicianStatus;
  currentWorkloadMinutes?: number;
  assignedJobsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  region: string;
  requiredSkill: string;
  priority: Priority;
  estimatedDurationMinutes: number;
  preferredStartTime: string;
  preferredEndTime: string;
  status: RequestStatus;
  isEmergency: boolean;
  currentAssignment?: {
    id: string;
    technicianId: string;
    technicianName: string;
    startTime: string;
    endTime: string;
    status: AssignmentStatus;
    source: AssignmentSource;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  scheduleVersionId: string;
  requestId: string;
  serviceRequest?: ServiceRequest;
  technicianId: string;
  technician?: Technician;
  startTime: string;
  endTime: string;
  status: AssignmentStatus;
  source: AssignmentSource;
  reasoning?: string;
  createdAt: string;
}

export interface ScheduleVersion {
  id: string;
  versionNumber: number;
  status: ScheduleStatus;
  trigger: ScheduleTrigger;
  createdAt: string;
  createdBy: string;
  metadata?: any;
  assignments: Assignment[];
}

export interface Violation {
  code: string;
  message: string;
  requestId?: string;
  technicianId?: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

export interface ProposedAssignment {
  requestId: string;
  technicianId: string;
  startTime: string;
  endTime: string;
  reason?: string;
  status?: AssignmentStatus;
  source?: AssignmentSource;
  isValid?: boolean;
  violations?: Violation[];
}

export interface ProposedUnassignedRequest {
  requestId: string;
  reason: string;
}

export interface ValidatedAiPlanResponse {
  assignments: ProposedAssignment[];
  unassignedRequests: ProposedUnassignedRequest[];
  tradeoffs: string[];
  questions: string[];
  validationSummary: {
    isValid: boolean;
    totalProposed: number;
    validCount: number;
    invalidCount: number;
    violations: Violation[];
  };
}

export interface ScheduleDiffItem {
  requestId: string;
  requestTitle: string;
  type: 'ADDED' | 'REMOVED' | 'CHANGED' | 'UNCHANGED' | 'UNASSIGNED';
  previousTechnicianId?: string;
  newTechnicianId?: string;
  previousStartTime?: string;
  newStartTime?: string;
  previousEndTime?: string;
  newEndTime?: string;
  reason: string;
  isCompleted?: boolean;
}

export interface ScheduleDiff {
  summary: {
    totalChanged: number;
    totalUnassigned: number;
    totalAdded: number;
    totalPreserved: number;
  };
  changes: ScheduleDiffItem[];
  tradeoffs: string[];
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  createdAt: string;
  actor: string;
}

export interface NotificationItem {
  id: string;
  assignmentId?: string;
  recipientType: string;
  recipientId: string;
  message: string;
  status: 'SENT' | 'PENDING' | 'READ';
  createdAt: string;
}
