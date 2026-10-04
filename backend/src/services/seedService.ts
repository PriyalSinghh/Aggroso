import { prisma } from '../db/prisma.js';

export async function runDatabaseSeed() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.scheduleVersion.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.technician.deleteMany();

  console.log('🧹 Cleared existing data.');

  // 1. Create Technicians
  const technicians = [
    {
      id: 'T1',
      name: 'Alex Miller',
      skills: 'Electrical,HVAC',
      region: 'North',
      availabilityStart: '08:00',
      availabilityEnd: '17:00',
      maxWorkloadMinutes: 480,
      status: 'AVAILABLE',
    },
    {
      id: 'T2',
      name: 'Sarah Chen',
      skills: 'Plumbing,Appliance',
      region: 'North',
      availabilityStart: '08:30',
      availabilityEnd: '16:30',
      maxWorkloadMinutes: 420,
      status: 'AVAILABLE',
    },
    {
      id: 'T3',
      name: 'Marcus Johnson',
      skills: 'Electrical,Appliance',
      region: 'North',
      availabilityStart: '09:00',
      availabilityEnd: '17:00',
      maxWorkloadMinutes: 480,
      status: 'AVAILABLE',
    },
    {
      id: 'T4',
      name: 'Elena Rodriguez',
      skills: 'HVAC,Plumbing',
      region: 'South',
      availabilityStart: '08:00',
      availabilityEnd: '16:00',
      maxWorkloadMinutes: 480,
      status: 'AVAILABLE',
    },
    {
      id: 'T5',
      name: 'David Kim',
      skills: 'Electrical,HVAC',
      region: 'South',
      availabilityStart: '08:00',
      availabilityEnd: '17:00',
      maxWorkloadMinutes: 480,
      status: 'AVAILABLE',
    },
  ];

  for (const tech of technicians) {
    await prisma.technician.create({ data: tech });
  }
  console.log(`✅ Seeded ${technicians.length} technicians.`);

  // 2. Create Service Requests
  const requests = [
    {
      id: 'R1',
      title: 'Commercial Circuit Breaker Tripping',
      description: 'Main electrical distribution panel overheating and tripping under peak office load.',
      region: 'North',
      requiredSkill: 'Electrical',
      priority: 'HIGH',
      estimatedDurationMinutes: 120,
      preferredStartTime: '09:00',
      preferredEndTime: '12:00',
      status: 'UNASSIGNED',
      isEmergency: false,
    },
    {
      id: 'R2',
      title: 'Main Water Line Leak in Server Basement',
      description: 'Severe pipe rupture causing water accumulation near server backup batteries.',
      region: 'North',
      requiredSkill: 'Plumbing',
      priority: 'CRITICAL',
      estimatedDurationMinutes: 90,
      preferredStartTime: '09:00',
      preferredEndTime: '11:30',
      status: 'UNASSIGNED',
      isEmergency: false,
    },
    {
      id: 'R3',
      title: 'Data Center Primary AC Unit Failure',
      description: 'Chiller compressor fault causing temperature rise in rack zone B.',
      region: 'North',
      requiredSkill: 'HVAC',
      priority: 'HIGH',
      estimatedDurationMinutes: 90,
      preferredStartTime: '13:00',
      preferredEndTime: '15:30',
      status: 'UNASSIGNED',
      isEmergency: false,
    },
    {
      id: 'R4',
      title: 'Industrial Kitchen Combi-Oven Error 404',
      description: 'Heating element sensor failure preventing lunch meal preparation.',
      region: 'North',
      requiredSkill: 'Appliance',
      priority: 'MEDIUM',
      estimatedDurationMinutes: 120,
      preferredStartTime: '11:00',
      preferredEndTime: '14:00',
      status: 'UNASSIGNED',
      isEmergency: false,
    },
    {
      id: 'R5',
      title: 'Backup Diesel Generator Annual Inspection',
      description: 'Routine scheduled electrical insulation and load test.',
      region: 'North',
      requiredSkill: 'Electrical',
      priority: 'LOW',
      estimatedDurationMinutes: 120,
      preferredStartTime: '14:00',
      preferredEndTime: '17:00',
      status: 'UNASSIGNED',
      isEmergency: false,
    },
    {
      id: 'R6',
      title: 'Office Complex HVAC Air Duct Inspection',
      description: 'Check air balance and damper actuators across 3rd floor office suite.',
      region: 'South',
      requiredSkill: 'HVAC',
      priority: 'MEDIUM',
      estimatedDurationMinutes: 120,
      preferredStartTime: '09:00',
      preferredEndTime: '12:00',
      status: 'UNASSIGNED',
      isEmergency: false,
    },
    {
      id: 'R7',
      title: 'Cafeteria Commercial Grease Trap Repair',
      description: 'Clogged drainage line with potential overflow risk in cafeteria.',
      region: 'South',
      requiredSkill: 'Plumbing',
      priority: 'HIGH',
      estimatedDurationMinutes: 90,
      preferredStartTime: '10:00',
      preferredEndTime: '13:00',
      status: 'UNASSIGNED',
      isEmergency: false,
    },
    {
      id: 'R8',
      title: 'Substation Transformer Diagnostics',
      description: 'Voltage irregularity on primary 480V distribution transformer.',
      region: 'South',
      requiredSkill: 'Electrical',
      priority: 'CRITICAL',
      estimatedDurationMinutes: 120,
      preferredStartTime: '13:00',
      preferredEndTime: '16:00',
      status: 'UNASSIGNED',
      isEmergency: false,
    },
    {
      id: 'R9',
      title: 'Residential Heat Pump Thermostat Calibration',
      description: 'Heat pump cycling short cycles during morning heating cycle.',
      region: 'South',
      requiredSkill: 'HVAC',
      priority: 'LOW',
      estimatedDurationMinutes: 90,
      preferredStartTime: '14:30',
      preferredEndTime: '16:30',
      status: 'UNASSIGNED',
      isEmergency: false,
    },
    {
      id: 'R10',
      title: 'Solar Inverter High-Voltage Calibration',
      description: 'Requires certified Solar Specialist credential in East region.',
      region: 'East',
      requiredSkill: 'SolarSpecialist',
      priority: 'MEDIUM',
      estimatedDurationMinutes: 120,
      preferredStartTime: '10:00',
      preferredEndTime: '14:00',
      status: 'UNASSIGNED',
      isEmergency: false,
    },
  ];

  for (const req of requests) {
    await prisma.serviceRequest.create({ data: req });
  }
  console.log(`✅ Seeded ${requests.length} service requests.`);

  // 3. Initial system audit log
  await prisma.auditLog.create({
    data: {
      action: 'SYSTEM_INITIALIZED',
      entityType: 'SYSTEM',
      entityId: 'SYSTEM',
      actor: 'System Seed',
      reason: 'Demo database seeded with technicians and service requests for daily dispatch.',
    },
  });

  console.log('🎉 Database seed completed successfully!');
}
