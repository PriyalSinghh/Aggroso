import { describe, it, expect } from 'vitest';
import { ConstraintValidationService } from '../src/services/constraintEngine.js';
import { Technician, ServiceRequest, Assignment } from '@prisma/client';

describe('ConstraintValidationService', () => {
  const sampleTech: Technician = {
    id: 'T1',
    name: 'Alex Miller',
    skills: 'Electrical,HVAC',
    region: 'North',
    availabilityStart: '08:00',
    availabilityEnd: '17:00',
    maxWorkloadMinutes: 480,
    status: 'AVAILABLE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleReq: ServiceRequest = {
    id: 'R1',
    title: 'Breaker Tripping',
    description: 'Electrical fault',
    region: 'North',
    requiredSkill: 'Electrical',
    priority: 'HIGH',
    estimatedDurationMinutes: 120,
    preferredStartTime: '09:00',
    preferredEndTime: '12:00',
    status: 'UNASSIGNED',
    isEmergency: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('1. Rejects skill mismatch', () => {
    const result = ConstraintValidationService.validateSchedule({
      proposedAssignments: [
        {
          requestId: 'R1',
          technicianId: 'T1',
          startTime: '09:00',
          endTime: '11:00',
        },
      ],
      technicians: [sampleTech],
      requests: [{ ...sampleReq, requiredSkill: 'Plumbing' }],
    });

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.code === 'SKILL_MISMATCH')).toBe(true);
  });

  it('2. Rejects region mismatch', () => {
    const result = ConstraintValidationService.validateSchedule({
      proposedAssignments: [
        {
          requestId: 'R1',
          technicianId: 'T1',
          startTime: '09:00',
          endTime: '11:00',
        },
      ],
      technicians: [sampleTech],
      requests: [{ ...sampleReq, region: 'South' }],
    });

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.code === 'REGION_MISMATCH')).toBe(true);
  });

  it('3. Rejects double booking for the same technician', () => {
    const req2: ServiceRequest = {
      ...sampleReq,
      id: 'R2',
      title: 'AC issue',
      requiredSkill: 'HVAC',
      preferredStartTime: '09:30',
      preferredEndTime: '12:30',
      estimatedDurationMinutes: 120,
    };

    const result = ConstraintValidationService.validateSchedule({
      proposedAssignments: [
        {
          requestId: 'R1',
          technicianId: 'T1',
          startTime: '09:00',
          endTime: '11:00',
        },
        {
          requestId: 'R2',
          technicianId: 'T1',
          startTime: '10:00',
          endTime: '12:00', // Overlaps with R1 (09:00-11:00)
        },
      ],
      technicians: [sampleTech],
      requests: [sampleReq, req2],
    });

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.code === 'DOUBLE_BOOKING')).toBe(true);
  });

  it('4. Rejects availability window violations (early start or late end)', () => {
    const resultEarly = ConstraintValidationService.validateSchedule({
      proposedAssignments: [
        {
          requestId: 'R1',
          technicianId: 'T1',
          startTime: '07:00', // Tech starts at 08:00
          endTime: '09:00',
        },
      ],
      technicians: [sampleTech],
      requests: [{ ...sampleReq, preferredStartTime: '07:00' }],
    });
    expect(resultEarly.valid).toBe(false);
    expect(resultEarly.violations.some((v) => v.code === 'OUTSIDE_AVAILABILITY')).toBe(true);

    const resultLate = ConstraintValidationService.validateSchedule({
      proposedAssignments: [
        {
          requestId: 'R1',
          technicianId: 'T1',
          startTime: '16:00',
          endTime: '18:00', // Tech ends at 17:00
        },
      ],
      technicians: [sampleTech],
      requests: [{ ...sampleReq, preferredStartTime: '16:00', preferredEndTime: '18:00' }],
    });
    expect(resultLate.valid).toBe(false);
    expect(resultLate.violations.some((v) => v.code === 'OUTSIDE_AVAILABILITY')).toBe(true);
  });

  it('5. Enforces maximum daily workload limit', () => {
    const limitedTech: Technician = {
      ...sampleTech,
      id: 'T_LIMITED',
      maxWorkloadMinutes: 180, // 3 hours max
    };

    const reqA: ServiceRequest = { ...sampleReq, id: 'RA', estimatedDurationMinutes: 120, preferredStartTime: '08:00', preferredEndTime: '11:00' };
    const reqB: ServiceRequest = { ...sampleReq, id: 'RB', estimatedDurationMinutes: 120, preferredStartTime: '11:00', preferredEndTime: '14:00' };

    const result = ConstraintValidationService.validateSchedule({
      proposedAssignments: [
        { requestId: 'RA', technicianId: 'T_LIMITED', startTime: '08:00', endTime: '10:00' }, // 120m
        { requestId: 'RB', technicianId: 'T_LIMITED', startTime: '11:00', endTime: '13:00' }, // 120m -> Total 240m > 180m
      ],
      technicians: [limitedTech],
      requests: [reqA, reqB],
    });

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.code === 'WORKLOAD_EXCEEDED')).toBe(true);
  });

  it('6. Rejects assignments to cancelled technicians', () => {
    const cancelledTech: Technician = {
      ...sampleTech,
      status: 'CANCELLED',
    };

    const result = ConstraintValidationService.validateSchedule({
      proposedAssignments: [
        { requestId: 'R1', technicianId: 'T1', startTime: '09:00', endTime: '11:00' },
      ],
      technicians: [cancelledTech],
      requests: [sampleReq],
    });

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.code === 'TECHNICIAN_CANCELLED')).toBe(true);
  });

  it('7. Rejects changes or deletion of completed assignments during replanning', () => {
    const completedAssignment: Assignment = {
      id: 'A1',
      scheduleVersionId: 'V1',
      requestId: 'R1',
      technicianId: 'T1',
      startTime: '09:00',
      endTime: '11:00',
      status: 'COMPLETED',
      source: 'MANUAL',
      reasoning: 'Finished',
      createdAt: new Date(),
    };

    // Attempting to move completed assignment to T2
    const resultMoved = ConstraintValidationService.validateSchedule({
      proposedAssignments: [
        { requestId: 'R1', technicianId: 'T2', startTime: '09:00', endTime: '11:00' },
      ],
      technicians: [
        sampleTech,
        { ...sampleTech, id: 'T2', name: 'Tech 2' },
      ],
      requests: [sampleReq],
      baseCompletedAssignments: [completedAssignment],
    });

    expect(resultMoved.valid).toBe(false);
    expect(resultMoved.violations.some((v) => v.code === 'COMPLETED_ASSIGNMENT_MODIFIED')).toBe(true);

    // Attempting to drop completed assignment
    const resultDropped = ConstraintValidationService.validateSchedule({
      proposedAssignments: [],
      technicians: [sampleTech],
      requests: [sampleReq],
      baseCompletedAssignments: [completedAssignment],
    });

    expect(resultDropped.valid).toBe(false);
    expect(resultDropped.violations.some((v) => v.code === 'COMPLETED_ASSIGNMENT_MODIFIED')).toBe(true);
  });
});
