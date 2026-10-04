import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { seed } from '../prisma/seed.js';

describe('Field Service Dispatch API Integration Tests', () => {
  beforeAll(async () => {
    await seed();
  });

  it('1. GET /api/health returns healthy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('2. GET /api/technicians and /api/requests return seeded data', async () => {
    const techRes = await request(app).get('/api/technicians');
    expect(techRes.status).toBe(200);
    expect(techRes.body.length).toBeGreaterThanOrEqual(5);

    const reqRes = await request(app).get('/api/requests');
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.length).toBeGreaterThanOrEqual(10);
  });

  it('3. POST /api/schedules/generate returns proposed plan with deterministic validation results', async () => {
    const res = await request(app).post('/api/schedules/generate').send({
      trigger: 'INITIAL_PLAN',
    });

    expect(res.status).toBe(200);
    expect(res.body.proposal).toBeDefined();
    expect(res.body.proposal.validationSummary).toBeDefined();
    expect(res.body.proposal.validationSummary.isValid).toBe(true);
    expect(res.body.proposal.assignments.length).toBeGreaterThan(0);
    expect(res.body.proposal.unassignedRequests.length).toBeGreaterThanOrEqual(1); // R10 (SolarSpecialist)
  });

  it('4. POST /api/schedules/validate rejects invalid assignments with detailed violation codes', async () => {
    const invalidPayload = {
      proposedAssignments: [
        {
          requestId: 'R1', // Needs Electrical in North
          technicianId: 'T2', // T2 has Plumbing in North
          startTime: '09:00',
          endTime: '11:00',
        },
      ],
    };

    const res = await request(app).post('/api/schedules/validate').send(invalidPayload);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.violations.some((v: any) => v.code === 'SKILL_MISMATCH')).toBe(true);
  });

  it('5. POST /api/schedules/approve creates ScheduleVersion 1, audit log, and mock notifications', async () => {
    // Generate valid plan first
    const genRes = await request(app).post('/api/schedules/generate').send({ trigger: 'INITIAL_PLAN' });
    const proposal = genRes.body.proposal;

    const approveRes = await request(app).post('/api/schedules/approve').send({
      proposedAssignments: proposal.assignments,
      trigger: 'INITIAL_PLAN',
      actor: 'Lead Dispatcher',
      metadata: {
        tradeoffs: proposal.tradeoffs,
        unassigned: proposal.unassignedRequests,
      },
    });

    expect(approveRes.status).toBe(201);
    expect(approveRes.body.schedule.versionNumber).toBe(1);
    expect(approveRes.body.schedule.status).toBe('APPROVED');
    expect(approveRes.body.notificationsCount).toBeGreaterThan(0);

    // Verify Audit Log
    const auditRes = await request(app).get('/api/audit-logs');
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.some((l: any) => l.action === 'SCHEDULE_APPROVED')).toBe(true);

    // Verify Notifications
    const notifRes = await request(app).get('/api/notifications');
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.length).toBeGreaterThan(0);
  });

  it('6. PATCH /api/assignments/:id rejects invalid manual edit with 422', async () => {
    const currentScheduleRes = await request(app).get('/api/schedules/current');
    const assignmentToEdit = currentScheduleRes.body.currentSchedule.assignments[0];

    // Attempt illegal edit: assign to technician with skill mismatch
    const badEditRes = await request(app)
      .patch(`/api/assignments/${assignmentToEdit.id}`)
      .send({
        technicianId: 'T4', // South region HVAC/Plumbing (incompatible if assignment is North/Electrical)
      });

    expect(badEditRes.status).toBe(422);
    expect(badEditRes.body.violations.length).toBeGreaterThan(0);
  });

  it('7. POST /api/technicians/:id/cancel cancels technician, generates replan diff, and allows Version 2 approval', async () => {
    // Cancel T1
    const cancelRes = await request(app).post('/api/technicians/T1/cancel').send({
      actor: 'Operations Manager',
    });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.diff).toBeDefined();
    expect(cancelRes.body.proposedPlan.validationSummary.isValid).toBe(true);

    // Approve Version 2
    const approveV2Res = await request(app).post('/api/schedules/approve').send({
      proposedAssignments: cancelRes.body.proposedPlan.assignments,
      trigger: 'TECHNICIAN_CANCELLATION',
      actor: 'Operations Manager',
      metadata: {
        diff: cancelRes.body.diff,
      },
    });

    expect(approveV2Res.status).toBe(201);
    expect(approveV2Res.body.schedule.versionNumber).toBe(2);

    // Verify previous version superseded
    const v1Res = await request(app).get('/api/schedules/versions');
    const v1 = v1Res.body.find((v: any) => v.versionNumber === 1);
    expect(v1.status).toBe('SUPERSEDED');
  });

  it('8. POST /api/requests/emergency creates critical ticket and replans for Version 3', async () => {
    const emergencyRes = await request(app).post('/api/requests/emergency').send({
      title: 'Hospital ICU Power Line Sparking',
      description: 'Critical electrical surge in medical ward.',
      region: 'North',
      requiredSkill: 'Electrical',
      estimatedDurationMinutes: 60,
      preferredStartTime: '14:00',
      preferredEndTime: '16:00',
      actor: 'Emergency Coordinator',
    });

    expect(emergencyRes.status).toBe(201);
    expect(emergencyRes.body.proposedPlan.validationSummary.isValid).toBe(true);

    // Approve Version 3
    const approveV3Res = await request(app).post('/api/schedules/approve').send({
      proposedAssignments: emergencyRes.body.proposedPlan.assignments,
      trigger: 'EMERGENCY_REQUEST',
      actor: 'Emergency Coordinator',
    });

    expect(approveV3Res.status).toBe(201);
    expect(approveV3Res.body.schedule.versionNumber).toBe(3);
  });
});
