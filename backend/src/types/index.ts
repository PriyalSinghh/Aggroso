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

export interface Violation {
  code:
    | 'SKILL_MISMATCH'
    | 'REGION_MISMATCH'
    | 'OUTSIDE_AVAILABILITY'
    | 'OUTSIDE_PREFERRED_WINDOW'
    | 'DURATION_MISMATCH'
    | 'WORKLOAD_EXCEEDED'
    | 'DOUBLE_BOOKING'
    | 'TECHNICIAN_CANCELLED'
    | 'REQUEST_CANCELLED'
    | 'COMPLETED_ASSIGNMENT_MODIFIED'
    | 'INVALID_TIME_FORMAT'
    | 'UNKNOWN_ENTITY';
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
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  reason?: string;
  status?: AssignmentStatus;
  source?: AssignmentSource;
  // Augmented by backend validation
  isValid?: boolean;
  violations?: Violation[];
}

export interface ProposedUnassignedRequest {
  requestId: string;
  reason: string;
}

export interface AiPlanOutput {
  assignments: ProposedAssignment[];
  unassignedRequests: ProposedUnassignedRequest[];
  tradeoffs: string[];
  questions: string[];
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
