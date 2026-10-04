# Agent Usage & Engineering Process Record

This document records the tooling, prompts, architectural delegations, resolved mistakes, and verification methodology utilized by the AI coding agent during the end-to-end development of the **Aggroso Field Service Dispatch and Replanning System**.

---

## 1. Tools Used

During development, the following tools and CLI utilities were employed:

- **Filesystem & Code Manipulation**:
  - `write_to_file`: Created initial project scaffold, configuration files (`tsconfig.json`, `tailwind.config.js`, `vite.config.ts`, `schema.prisma`), frontend components, and backend services.
  - `replace_file_content`: Applied targeted, surgical modifications, bug fixes, and import updates to existing files without rewriting whole modules.
  - `view_file`: Inspected generated logs, database seed files, and source code chunks during verification.

- **Process & Command Execution**:
  - `run_command` & `manage_task`: Executed dependency installations (`npm install`), database migrations and pushes (`prisma db push`), seed scripts (`npm run seed`), TypeScript compilation checks (`tsc`), production bundling (`vite build`), and the test suite (`vitest run`).

- **Frameworks & Runtimes**:
  - **Prisma CLI**: Generated type-safe clients and synced database schemas.
  - **Vitest & Supertest**: Ran automated unit tests on constraint logic and integration tests across Express REST endpoints.
  - **Vite & Tailwind CSS Compiler**: Validated frontend JSX/TSX syntax and stylesheet compilation.

---

## 2. Representative Prompts

### A. Core System Design Prompt
> *"Build a Field Service Dispatch and Replanning Agent managing service requests and technicians for one working day. The dispatcher must view requests/technicians, generate an initial plan, see a timeline, use an AI agent to propose assignments, validate all proposals using deterministic backend rules, edit assignments manually, approve assignments, maintain schedule versions, handle cancellations and emergency requests without changing completed work, and show diffs. AI PROPOSES → DETERMINISTIC VALIDATION → HUMAN APPROVAL → CONFIRMED SCHEDULE."*

### B. AI Optimizer System Prompt (Engine Prompt)
```text
You are an expert AI Field Service Dispatch Optimizer.
Your goal is to propose an optimal schedule assigning service requests to available technicians for the workday.

CRITICAL CONSTRAINTS TO RESPECT:
1. Technician Skills: A technician MUST have the request's requiredSkill.
2. Region: A technician's region MUST match the request's region.
3. Availability: Assignments must be between technician.availabilityStart and technician.availabilityEnd.
4. Preferred Window: Assignments must be within request.preferredStartTime and request.preferredEndTime.
5. Duration: (endTime - startTime) in minutes MUST equal request.estimatedDurationMinutes.
6. Max Workload: Total daily assigned minutes per technician must not exceed technician.maxWorkloadMinutes.
7. No Double Booking: No overlapping time slots for the same technician.
8. Cancelled Technicians: Never assign to a technician with status 'CANCELLED'.
9. Cancelled Requests: Never assign a request with status 'CANCELLED'.
10. Completed Assignments: Must NOT be modified or moved. Keep them exact.

YOU MUST RESPOND WITH STRICT VALID JSON adhering to the specified schema.
```

---

## 3. Delegated Work & System Boundaries

Work was split into clean decoupled boundaries:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Heuristic / AI Proposer (aiService.ts & deterministicPlanner.ts)         │
│    - Responsibility: Suggest candidate slots, balance load, provide reason  │
│    - Status: Untrusted proposal (DRAFT)                                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Deterministic Constraint Engine (constraintEngine.ts)                   │
│    - Responsibility: Enforce 10 hard validation rules deterministically     │
│    - Authority: Final gatekeeper for valid/invalid state                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Human Dispatcher Interface (React Timeline & Diff Modals)                │
│    - Responsibility: Review violations, inspect trade-offs, approve/edit    │
│    - Status: Human in the loop                                              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. Schedule Versioning & Audit Engine (schedules.ts & auditService.ts)      │
│    - Responsibility: Persist immutable versions (v1, v2), notifications     │
│    - Status: CONFIRMED SCHEDULE                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Important Agent Mistakes & Rejected Suggestions

1. **Mistake: Variable identifier mismatch in `ScheduleDiffService`**:
   - *Issue*: During the creation of `ScheduleDiffService.computeDiff`, lines 43, 70, 84, and 108 pushed `{ requestTitle, ... }` while the local variable was declared as `const reqTitle = ...`.
   - *Impact*: Caused runtime ReferenceError `requestTitle is not defined` during replanning integration tests.
   - *Fix*: The agent ran `npm test`, identified the exact error stack trace, and applied `replace_file_content` to consistently map `requestTitle: reqTitle`.

2. **Mistake: Top-level invocation in seed script on test import**:
   - *Issue*: `prisma/seed.ts` executed top-level `seed()` whenever imported inside Vitest test files, which triggered unexpected `process.exit(1)` upon completion.
   - *Fix*: Refactored seed logic into `src/services/seedService.ts` and guarded `prisma/seed.ts` to only invoke `runDatabaseSeed()` when executed as the primary CLI entrypoint.

3. **Rejected Suggestion: Allowing LLM to direct-write assignments to database**:
   - *Design Decision*: Any proposal to let the AI API directly invoke database mutation methods was explicitly rejected. The system strictly forces all AI output to be piped through `ConstraintValidationService.validateSchedule()` before being presented to the human dispatcher for approval.

4. **Rejected Suggestion: In-place schedule mutation without versioning**:
   - *Design Decision*: Overwriting past approved schedules was rejected in favor of immutable `ScheduleVersion` entities (`v1`, `v2`, `v3` with trigger tagging: `INITIAL_PLAN`, `TECHNICIAN_CANCELLATION`, `EMERGENCY_REQUEST`), allowing full diff tracking and retrospective analysis.

---

## 5. Output Verification & Testing Methodology

The system was verified through four rigorous validation layers:

1. **Automated Unit Tests ([`constraints.test.ts`](file:///Users/priyalsingh/Desktop/Aggroso/backend/tests/constraints.test.ts))**:
   - Verified that skill mismatches, region mismatches, double bookings, shift availability breaches, daily workload caps, cancelled technician assignments, and attempts to modify completed assignments are deterministically rejected with appropriate violation codes.

2. **Automated Integration Tests ([`api.test.ts`](file:///Users/priyalsingh/Desktop/Aggroso/backend/tests/api.test.ts))**:
   - Verified the complete lifecycle: Health checks -> Data retrieval -> AI proposal generation -> Constraint validation -> Version 1 approval -> Mock notification generation -> Audit trail recording -> Technician cancellation -> Version 2 replanning & diff calculation -> Emergency request creation -> Version 3 replanning.

3. **Type Checking & Build Verification**:
   - Backend: `npm run build` (`tsc`) compiles with zero TypeScript errors.
   - Frontend: `npm run build` (`tsc && vite build`) bundles cleanly into static production assets.

4. **Manual End-to-End Workflow Verification**:
   - Verified seeded technicians and work orders display on the visual Gantt timeline.
   - Verified modal displays validation checkmarks and unassigned reasons (e.g. `R10` lacking `SolarSpecialist` in `East`).
   - Verified manual edits via the slide-out drawer trigger real-time validation checks.
   - Verified technician cancellation (e.g. Alex Miller `T1`) dynamically triggers the replanning diff modal showing reassignments to `T3`.
   - Verified emergency work order injection creates a `CRITICAL` ticket and recalculates the revised schedule.
