# Aggroso — Field Service Dispatch and Replanning System

A production-ready field service dispatch and autonomous replanning application combining AI-assisted schedule proposals with deterministic backend constraint validation, human dispatcher approval workflows, and immutable schedule versioning.

---

## 1. Project Overview & Core Philosophy

Field service operations require balancing technician certifications, geographic territories, shift operating windows, and daily workload caps. 

Aggroso implements the following core architectural principle:

$$\mathbf{AI\ Optimization\ Proposal} \longrightarrow \mathbf{Deterministic\ Validation} \longrightarrow \mathbf{Human\ Dispatcher\ Approval} \longrightarrow \mathbf{Confirmed\ Schedule}$$

> [!IMPORTANT]
> **AI is never the source of truth for constraints.** The LLM proposes candidate schedules, load balancing strategies, and trade-off rationales, while a deterministic backend constraint engine serves as the final authority, ensuring zero invalid assignments can ever be confirmed or persisted.

---

## 2. Architecture & System Design

```
                               ┌─────────────────────────────┐
                               │       React Frontend        │
                               │  Vite + Tailwind + Router   │
                               └──────────────┬──────────────┘
                                              │ HTTP / JSON API
                                              ▼
                               ┌─────────────────────────────┐
                               │    Express REST Backend     │
                               │        (TypeScript)         │
                               └──────┬───────┬───────┬──────┘
                                      │       │       │
       ┌──────────────────────────────┘       │       └─────────────────────────────┐
       ▼                                      ▼                                     ▼
┌──────────────┐                     ┌──────────────────┐                  ┌──────────────────┐
│  AI Service  │                     │  Deterministic   │                  │ Schedule Version │
│ (OpenAI / LLM│                     │ Constraint Engine│                  │   & Diffing      │
│ + Fallback)  │                     │ (Hard Authority) │                  │     Engine       │
└──────┬───────┘                     └────────┬─────────┘                  └────────┬─────────┘
       │ Proposals                            │ Structured Violations               │
       └─────────────────────────────► ◄──────┘                                     │
                                              │                                     │
                                              ▼                                     ▼
                               ┌──────────────────────────────────────────────────────────────┐
                               │                    Prisma ORM & Database                     │
                               │                 (PostgreSQL / SQLite dev)                    │
                               └──────────────────────────────────────────────────────────────┘
```

### Module Responsibilities:
- **`ConstraintValidationService`**: 10 hard deterministic rules checking skills, regions, shift hours, time windows, durations, workload maximums, double-booking, cancellations, and completed job immutability.
- **`DeterministicPlannerService`**: Fast priority-based heuristic planner with load balancing.
- **`OpenAiCompatibleAiService`**: Clean AI provider abstraction supporting any OpenAI-compatible endpoint with intelligent fallback when credentials are not configured.
- **`ReplanningService` & `ScheduleDiffService`**: Dynamic event-driven replanning for technician sick leave and critical emergency work orders, generating detailed before/after diffs (`CHANGED`, `UNASSIGNED`, `ADDED`, `PRESERVED`).
- **`AuditService` & `NotificationService`**: Complete chronological audit trail and simulated multi-channel dispatch notifications.

---

## 3. Completed vs Excluded Scope

### Completed Scope
- **Interactive Visual Timeline**: Real-time Gantt schedule from 08:00 to 18:00 with color-coded priority blocks, technician capacity bars, and click-to-edit drawer.
- **AI Proposal Review Flow**: Review modal presenting proposed assignments, validation checkmarks, constraint violations, unassigned tickets, and optimization trade-offs.
- **Schedule Replanning & Diff Viewer**: Automated workflow handling technician cancellations and emergency tickets with clear comparison of changes.
- **Immutable Schedule Versioning**: Automatic version numbering (`v1`, `v2`, `v3`) with trigger annotations (`INITIAL_PLAN`, `TECHNICIAN_CANCELLATION`, `EMERGENCY_REQUEST`).
- **Manual Assignment Overrides**: In-drawer editing with live backend constraint validation.
- **Locked Completed Jobs**: Jobs marked `COMPLETED` cannot be shifted or dropped during future replans.
- **Mock Notifications**: Dispatch confirmation messages generated for technicians and customers upon approval.
- **Audit Logging**: Full chronological log with before/after state diffs.
- **Automated Test Suite**: 17 unit and integration tests covering all business rules and API workflows.

### Excluded Scope (By Design)
- Real GPS tracking and turn-by-turn map routing.
- Real SMS / Email carrier integrations (handled via simulated mock notifications).
- Multi-day / overnight shift scheduling (scoped to single working day).
- Inventory parts tracking and vehicle fleet maintenance.
- User authentication / role-based login (scoped to dispatcher operations console).

---

## 4. Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Lucide React Icons.
- **Backend**: Node.js 22, TypeScript, Express.
- **Database & ORM**: Prisma ORM with SQLite for local development and PostgreSQL required for production deployments.
- **AI Abstraction**: OpenAI-compatible LLM abstraction with deterministic fallback logic.
- **Testing**: Vitest, Supertest, React Testing Library.

---

## 5. Local Setup & Running

### Prerequisites
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Step 1: Install Dependencies & Setup Database
```bash
# Clone the repository
git clone <repo-url>
cd Aggroso

# One-step setup (installs root, backend, frontend, syncs schema, seeds data)
npm run setup
```

### Step 2: Configure Environment Variables (Optional)
Copy `.env.example` to `.env` in `backend/`:
```bash
cp .env.example backend/.env
```
For production deployments, set a PostgreSQL connection string instead of the default SQLite value:
```bash
DATABASE_URL="postgresql://aggroso:aggroso@localhost:5432/aggroso"
```
```bash
# Terminal 1: Backend (port 5001)
npm run dev:backend

# Terminal 2: Frontend (port 3000)
npm run dev:frontend
```

Open your browser at **`http://localhost:3000`**.

---

## 6. Running Tests

Execute the full automated test suite using Vitest:

```bash
# Run all unit and integration tests
npm test
```

### Test Coverage Highlights:
- **`tests/constraints.test.ts`**: Skill mismatch, region mismatch, double booking, shift hours violation, workload limit violation, cancelled technician assignment, and completed task protection.
- **`tests/planner.test.ts`**: Priority heuristic planning and unassigned reason generation.
- **`tests/api.test.ts`**: Full end-to-end API lifecycle (Plan generation -> Validation -> Approval -> Notifications -> Cancellation -> Replanning Diff -> Version 2 Approval -> Emergency Request -> Version 3 Approval).

---

## 7. Deployment Instructions

The application is structured for easy single-port production deployment or containerized deployment.

### Option A: Docker / Container Deployment (Recommended)
A production multi-stage [`Dockerfile`](file:///Users/priyalsingh/Desktop/Aggroso/Dockerfile) and [`docker-compose.yml`](file:///Users/priyalsingh/Desktop/Aggroso/docker-compose.yml) are included.

```bash
# Build and run container locally or on any cloud server (AWS EC2, DigitalOcean, GCP)
docker-compose up --build
```
Access the application at `http://localhost:5001`.

### Option B: Render / Railway / Fly.io (Single Service)
1. Connect your GitHub repository to **Render** or **Railway**.
2. Set Environment Variables:
   - `NODE_ENV=production`
   - `PORT=5001`
   - `DATABASE_URL=postgresql://user:password@host:5432/aggroso`
3. Set Build Command:
   ```bash
   cd backend && npm install && npx prisma generate --schema=prisma/schema.postgresql.prisma && npm run build
   ```
4. Set Start Command:
   ```bash
   cd backend && npx prisma db push --schema=prisma/schema.postgresql.prisma && npm run seed && npm start
   ```
*SQLite is only valid for local development; production environments must use PostgreSQL and the PostgreSQL Prisma schema.*

### Option C: Split Deployment (Vercel Frontend + Render/Railway Backend)
1. **Frontend (Vercel)**:
   - Root directory: `frontend`
   - Framework preset: `Vite`
   - Set environment variable: `VITE_API_BASE_URL=https://your-backend.onrender.com/api`
2. **Backend (Render / Railway)**:
   - Root directory: `backend`
   - Build command: `npx prisma generate --schema=prisma/schema.postgresql.prisma && npm run build`
   - Start command: `npx prisma db push --schema=prisma/schema.postgresql.prisma && npm run seed && npm start`

---

## 8. Known Limitations & Future Roadmap

1. **Single-Day Time Horizon**: The current dispatch horizon covers a single operational shift (08:00–18:00). Multi-day scheduling across consecutive days can be added by expanding time indices to full ISO dates.
2. **Deterministic Distance Matrix**: Regional matching uses discrete operational zones (`North`, `South`, `East`, `West`). Integrating an actual road-network distance matrix (e.g. OSRM or Google Maps Distance Matrix) would refine travel buffers.
3. **Multi-Technician Jobs**: Jobs currently assign one primary qualified technician. Multi-party crew scheduling can be supported by extending the assignment schema to multi-technician relations.
