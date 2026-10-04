import { describe, it, expect } from 'vitest';
import { DeterministicPlannerService } from '../src/services/deterministicPlanner.js';
import { ConstraintValidationService } from '../src/services/constraintEngine.js';
import { Technician, ServiceRequest } from '@prisma/client';

describe('DeterministicPlannerService', () => {
  const techs: Technician[] = [
    {
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
    },
    {
      id: 'T2',
      name: 'Sarah Chen',
      skills: 'Plumbing',
      region: 'North',
      availabilityStart: '08:00',
      availabilityEnd: '17:00',
      maxWorkloadMinutes: 480,
      status: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const requests: ServiceRequest[] = [
    {
      id: 'R1',
      title: 'Plumbing leak',
      description: 'Pipe broken',
      region: 'North',
      requiredSkill: 'Plumbing',
      priority: 'CRITICAL',
      estimatedDurationMinutes: 90,
      preferredStartTime: '09:00',
      preferredEndTime: '12:00',
      status: 'UNASSIGNED',
      isEmergency: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'R2',
      title: 'Solar repair',
      description: 'Solar panel wire',
      region: 'North',
      requiredSkill: 'SolarSpecialist', // No technician has this
      priority: 'MEDIUM',
      estimatedDurationMinutes: 120,
      preferredStartTime: '10:00',
      preferredEndTime: '14:00',
      status: 'UNASSIGNED',
      isEmergency: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it('Generates valid assignments for assignable requests', () => {
    const plan = DeterministicPlannerService.generatePlan({
      technicians: techs,
      requests,
    });

    expect(plan.assignments.length).toBe(1);
    expect(plan.assignments[0].requestId).toBe('R1');
    expect(plan.assignments[0].technicianId).toBe('T2');

    // Deterministic validation pass
    const validation = ConstraintValidationService.validateSchedule({
      proposedAssignments: plan.assignments,
      technicians: techs,
      requests,
    });

    expect(validation.valid).toBe(true);
    expect(validation.violations.length).toBe(0);
  });

  it('Gracefully marks requests without qualified technicians as unassigned with clear reason', () => {
    const plan = DeterministicPlannerService.generatePlan({
      technicians: techs,
      requests,
    });

    expect(plan.unassignedRequests.length).toBe(1);
    expect(plan.unassignedRequests[0].requestId).toBe('R2');
    expect(plan.unassignedRequests[0].reason).toContain('SolarSpecialist');
  });
});
