# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build (prisma generate + db push + next build)
npm run lint         # ESLint
npx prisma migrate dev --name <name>  # Create DB migration
npx prisma db push   # Sync schema without migration
npx prisma db seed   # Seed test data (prisma/seed.ts)
npx tsc --noEmit     # Type check
```

## Architecture

**Next.js 15 App Router** + **Prisma 6 (SQLite local / PostgreSQL production)** + **Zustand** + **Tailwind CSS 4**

This is a hospital nurse scheduling management system (42병동 간호사 근무표 관리). All UI text is in Korean.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.5.x |
| Language | TypeScript | 5.9.x |
| Runtime | React | 19.2.x |
| ORM | Prisma Client | 6.19.x |
| Database | SQLite (local) / PostgreSQL (Neon, production) | - |
| State | Zustand | 5.0.x |
| Styling | Tailwind CSS | 4.2.x |
| Icons | Lucide React | 0.575.x |
| Excel | SheetJS (xlsx) | 0.18.x |
| Print | react-to-print | 3.2.x |
| Validation | Zod | 4.3.x |
| Date | date-fns | 4.1.x |
| Theme | next-themes | 0.4.x |
| Table | @tanstack/react-table | 8.21.x |
| Auth | bcryptjs + jose (JWT) | 3.x / 6.x |
| Utility | clsx | 2.x |
| Linting | ESLint (flat config) | 9.39.x |

### Data Flow

```
Browser → Middleware (JWT verify) → Next.js API Routes (src/app/api/) → Prisma → SQLite (local) / PostgreSQL (prod)
                                                                          ↕
Browser ← React Components ← Zustand Store (schedule grid state) + AuthContext (user session)
```

### Core Domain Model (Prisma, 11 models)

```
Ward ──1:N──→ Nurse ──1:N──→ ScheduleEntry
  │                  └──1:N──→ ScheduleSummary
  │                  └──1:N──→ ScheduleChangeLog
  └──1:N──→ Schedule ──1:N──→ ScheduleEntry
                │     └──1:N──→ ScheduleSummary
                │     └──1:N──→ ScheduleApproval
                │     └──1:N──→ ScheduleChangeLog
                │     └──1:N──→ SchedulePrintLog
                └──N:1──→ User (createdBy, confirmedBy)
```

- **Ward** → has many Nurses, Users, Schedules
- **Nurse** → belongs to Ward, has many Entries/Summaries/ChangeLogs
- **User** → system account with role (HEAD_NURSE, NURSING_MANAGER, NURSING_DIRECTOR, ADMIN)
- **ShiftType** → shift master data (D, E, N, O, X, T, B)
- **Schedule** (ward + year + month + version) → has many Entries, Summaries, Approvals, ChangeLogs, PrintLogs
- **ScheduleEntry** = one nurse's shift for one day (unique: scheduleId + nurseId + workDate)
- **ScheduleSummary** = per-nurse monthly aggregates (D/E/N/T/X/O/XO counts)
- **ScheduleApproval** = approval workflow history (step, role, action, comment)
- **ScheduleChangeLog** = audit trail of all cell edits (previous/new shift code, version)
- **SchedulePrintLog** = print action history (format, timestamp)
- **NursePreference** = nurse shift preferences per day (nurseId + year + month + day unique, priority: PREFER/STRONG/MUST)
- Schedule status flow: `DRAFT` → `CONFIRMED` (one confirmed per ward/month)
- Unique constraints: Schedule(wardId, year, month, version), Entry(scheduleId, nurseId, workDate), Summary(scheduleId, nurseId)
- Cascading deletes on Schedule-dependent tables

### Shift Codes

`D` (주간/Day), `E` (저녁/Evening), `N` (야간/Night), `T` (교육/Training), `O` (공휴/Holiday), `X` (휴무/Off), `B` (기타/Other)

### Nurse Positions (positionRank order)

`HN` (수간호사, rank 1), `CN` (책임간호사, rank 2), `AN` (주임간호사, rank 3), `RN` (일반간호사, rank 4)

## Project Structure

```
src/
├── app/
│   ├── api/                    # API Routes
│   │   ├── auth/               # Authentication
│   │   │   ├── login/          # POST: login (bcrypt verify → JWT cookie)
│   │   │   ├── logout/         # POST: clear auth cookie
│   │   │   └── me/             # GET: current user from JWT
│   │   ├── dashboard/          # GET: dashboard stats
│   │   ├── nurses/             # GET/POST, [id] GET/PUT/DELETE
│   │   ├── schedules/          # GET/POST, [id] GET/PATCH/DELETE
│   │   │   └── [id]/
│   │   │       ├── entries/    # GET/PUT: shift entries + change logs
│   │   │       ├── excel/      # GET: xlsx export
│   │   │       ├── history/    # GET: change audit log
│   │   │       ├── previous/   # GET: previous month reference
│   │   │       ├── preferences/ # GET/POST: nurse shift preferences
│   │   │       ├── print/      # POST/GET: print log
│   │   │       ├── generate/   # POST: AI schedule generation
│   │   │       └── stats/      # GET: per-nurse statistics
│   │   ├── seed/               # POST: seed database
│   │   ├── shift-types/        # GET/POST, [id] route
│   │   └── wards/              # GET/POST, [id] PUT/DELETE
│   ├── login/                  # Client component — login page (public, no sidebar)
│   ├── dashboard/              # Server component — today's shifts, week preview, alerts
│   ├── nurses/                 # Client component — nurse CRUD
│   └── schedules/              # Client component — schedule list
│       └── [id]/edit/          # Client component — schedule grid editor (~1070 lines)
├── components/
│   ├── layout/                 # Sidebar, Header, MainContent, Providers
│   ├── schedule/               # ScheduleGrid, ShiftCell, ChangeHistory, PrintLayout,
│   │                           # GenerateScheduleModal, PreferenceEditor, VacationEditor
│   └── ui/                     # Button, Badge, Modal, NurseFormModal, ThemeToggle
├── contexts/                   # SidebarContext, AuthContext
├── lib/
│   ├── auth.ts                 # JWT auth helpers (hash, verify, token create/verify, getCurrentUser)
│   ├── prisma.ts               # Singleton PrismaClient
│   ├── utils.ts                # Date helpers, SHIFT_COLORS, STATUS/ROLE/POSITION labels, cn()
│   ├── korean-holidays.ts      # Fixed + lunar holiday lookup (2024-2030)
│   └── scheduling/             # AI scheduling algorithm (6-phase + Simulated Annealing)
│       ├── index.ts            # Public exports
│       ├── generator.ts        # Main 6-phase algorithm
│       ├── state.ts            # State helpers
│       ├── scorer.ts           # Scoring function
│       ├── validator.ts        # Constraint validation
│       └── swap-operators.ts   # SA swap operations
├── middleware.ts                # Next.js middleware — JWT auth guard (redirects to /login)
├── store/
│   └── schedule.ts             # Zustand store for grid state
└── types/
    ├── index.ts                # Prisma re-exports + ScheduleGridData type
    └── scheduling.ts           # AI scheduling algorithm type definitions
```

## Key Patterns

### Authentication (JWT + Cookie)
- **Login flow**: POST `/api/auth/login` → bcrypt verify → JWT (HS256, 7-day expiry) → `auth-token` httpOnly cookie
- **Middleware** (`src/middleware.ts`): Intercepts all routes except `/login` and `/api/auth/*`. Unauthenticated requests → redirect to `/login` (pages) or 401 (API).
- **AuthContext** (`src/contexts/AuthContext.tsx`): Client-side React context wrapping the app in `Providers`. Fetches `/api/auth/me` on mount, provides `user`, `loading`, `logout()`.
- **Header**: Shows logged-in user name + role badge + logout button.
- **`requireCurrentUser()`** (`src/lib/auth.ts`): Server-side helper used in API routes (schedules POST/PATCH, entries PUT, print POST) to get the current user from JWT. Falls back to first DB user for backward compatibility.
- **Seed accounts** (all password `1234`): `headnurse` (진인숙, HEAD_NURSE), `chargenurse` (김경선, HEAD_NURSE), `manager` (이정숙, NURSING_MANAGER), `director` (박영희, NURSING_DIRECTOR), `admin` (시스템관리자, ADMIN)
- **Environment variable**: `JWT_SECRET` (defaults to `fallback-secret-change-me`)

### Schedule Grid (`src/components/schedule/ScheduleGrid.tsx`)
The central UI component. An interactive table with:
- Sticky header (thead) — fixed during vertical scroll (`sticky top-0 z-30`)
- Sticky left columns (사원번호, 사원명, 직위) — fixed during horizontal scroll (`sticky left-[N] z-10/z-40`)
- Max height container (`max-h-[calc(100vh-280px)] overflow-auto`) for both scroll axes
- Mouse drag selection + Shift+Click extend
- Ctrl+C/V copy/paste via hidden textarea pattern (Google Sheets approach, tab-separated format, supports Excel/Notepad external paste)
- Per-nurse summary columns (D/E/N/T/X/O/XO) + extra stats (주말/연속/시간)
- Daily shift count footer rows (D/E/N/T/X, T+X, 일별 총인원 = D+E+N+T+X)
- `NurseRow` is `memo()`-wrapped for performance

### Zustand Store (`src/store/schedule.ts`)
Client-side state for the schedule editing grid. Key fields:
- `gridData: ScheduleGridData[]` — all nurse rows with entries and summaries
- `isDirty: boolean` — unsaved changes flag
- `updateCell()` — single cell edit + recalculate summary
- `updateCells()` — batch update for paste operations, recalculates summaries inline
- `addNurse()` / `removeNurse()` — grid row management

### ScheduleGridData Type (`src/types/index.ts`)
```typescript
{ nurseId, nurseName, employeeNumber, position, sortOrder,
  entries: Record<number, string>,  // { dayNumber: shiftCode }
  summary: { D, E, N, T, X, O, XO } }
```

### Schedule Edit Page (`src/app/schedules/[id]/edit/page.tsx`)
~1070 lines handling: load/save entries, confirm/unconfirm, add/remove nurses, reset, print, Excel export, previous month reference. On first load with no entries, HN/CN nurses get auto-filled (weekday=D, weekend=O).

### Save Flow (PUT `/api/schedules/[id]/entries`)
1. Receives `{ entries, nurseIds }` — all shift entries + list of nurse IDs in grid
2. Compares with existing DB entries to detect changes/deletions
3. Creates `ScheduleChangeLog` for every change
4. Upserts entries, deletes removed ones
5. Recalculates `ScheduleSummary` for affected nurses
6. Cleans up summaries for nurses not in `nurseIds`

### Confirm Constraint
Only one CONFIRMED schedule per ward/year/month. The PATCH endpoint checks for existing confirmed schedule before allowing confirmation. All nurses must have all days filled to confirm.

### AI Schedule Generation (`src/lib/scheduling/`)
6-phase algorithm with Simulated Annealing optimization (~1,155 lines total):
1. **Phase 1** — Fixed Assignment: HN/CN → mandatory positions (weekday=D, weekend=O)
2. **Phase 2** — Off Distribution: Fair off-day allocation respecting previous month
3. **Phase 3** — Night Assignment: N shift placement with fairness scoring
4. **Phase 4** — Evening Assignment: E shift placement
5. **Phase 5** — Day Filling: D shift to meet minimum staffing
6. **Phase 6** — Simulated Annealing: Optimize via swap operations (5000 iterations, cooling 0.995)

Key files:
- `generator.ts` — Main algorithm (490 lines)
- `scorer.ts` — Multi-factor scoring (preference, fairness, consecutive penalties)
- `validator.ts` — Hard/soft constraint validation (min staffing, max consecutive)
- `swap-operators.ts` — SA swap: SAME_DAY_SWAP, SAME_NURSE_SWAP, SINGLE_REASSIGN
- `state.ts` — State helpers
- `src/types/scheduling.ts` — Type definitions (ShiftCode, PreferencePriority, ScheduleGenerationConfig, etc.)
- `src/lib/korean-holidays.ts` — Fixed + lunar holidays lookup (2024-2030), weekend/holiday detection

API endpoints:
- `POST /api/schedules/[id]/generate` — Generate AI schedule (preview mode)
- `GET/POST /api/schedules/[id]/preferences` — Nurse shift preferences (PREFER/STRONG/MUST)

UI components:
- `GenerateScheduleModal` — AI generation config modal (min staff, constraints, iterations)
- `PreferenceEditor` — Per-nurse daily preference editor
- `VacationEditor` — Vacation/off day editor

### Dashboard (`src/app/dashboard/page.tsx`)
Server component that queries only CONFIRMED schedules for the current month. Shows today's shifts, week preview, fairness metrics, alerts (consecutive days ≥5, N→D violations), staff stats.

### Sorting
Nurses are sorted by `sortOrder` (not employeeNumber). This preserves the user-defined display order throughout the grid, dashboard, and all data views.

### Layout
- Collapsible sidebar (`SidebarContext` with localStorage persistence)
- Dark mode support (`next-themes`, class strategy)
- Responsive: sidebar collapses on mobile
- Provider hierarchy: `ThemeProvider` → `AuthProvider` → `SidebarProvider`
- Login page renders outside the sidebar/header layout

## Path Alias

`@/*` → `src/*` (configured in tsconfig.json)

## Deployment

- Platform: Vercel
- Database (local): SQLite — `DATABASE_URL="file:./dev.db"` in `.env`
- Database (production): Vercel Postgres (Neon) — switch provider to `postgresql` in `prisma/schema.prisma` and set `DATABASE_URL` / `DATABASE_URL_UNPOOLED`
- Environment variables: `DATABASE_URL`, `JWT_SECRET`
- Build: `prisma generate && prisma db push && next build`
