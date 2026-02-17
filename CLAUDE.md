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

**Next.js 14 App Router** + **Prisma (PostgreSQL)** + **Zustand** + **Tailwind CSS**

This is a hospital nurse scheduling management system (42병동 간호사 근무표 관리). All UI text is in Korean.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.x |
| Language | TypeScript | 5.x |
| ORM | Prisma Client | 5.22.x |
| Database | PostgreSQL (Neon, Vercel Postgres) | - |
| State | Zustand | 5.x |
| Styling | Tailwind CSS | 3.4.x |
| Icons | Lucide React | 0.564.x |
| Excel | SheetJS (xlsx) | 0.18.x |
| Print | react-to-print | 3.2.x |
| Validation | Zod | 4.x |
| Date | date-fns | 4.x |
| Theme | next-themes | 0.4.x |
| Table | @tanstack/react-table | 8.x (installed, not yet used in grid) |
| Utility | clsx | 2.x |

### Data Flow

```
Browser → Next.js API Routes (src/app/api/) → Prisma → PostgreSQL
                                                ↕
Browser ← React Components ← Zustand Store (schedule grid state)
```

### Core Domain Model (Prisma, 10 models)

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
│   │   ├── dashboard/          # GET: dashboard stats
│   │   ├── nurses/             # GET/POST, [id] GET/PUT/DELETE
│   │   ├── schedules/          # GET/POST, [id] GET/PATCH/DELETE
│   │   │   └── [id]/
│   │   │       ├── entries/    # GET/PUT: shift entries + change logs
│   │   │       ├── excel/      # GET: xlsx export
│   │   │       ├── history/    # GET: change audit log
│   │   │       ├── previous/   # GET: previous month reference
│   │   │       ├── print/      # POST/GET: print log
│   │   │       └── stats/      # GET: per-nurse statistics
│   │   ├── seed/               # POST: seed database
│   │   ├── shift-types/        # GET/POST, [id] route
│   │   └── wards/              # GET/POST, [id] PUT/DELETE
│   ├── dashboard/              # Server component — today's shifts, week preview, alerts
│   ├── nurses/                 # Client component — nurse CRUD
│   └── schedules/              # Client component — schedule list
│       └── [id]/edit/          # Client component — schedule grid editor (~1070 lines)
├── components/
│   ├── layout/                 # Sidebar, Header, MainContent, Providers
│   ├── schedule/               # ScheduleGrid, ShiftCell, ChangeHistory, PrintLayout
│   └── ui/                     # Button, Badge, Modal, NurseFormModal, ThemeToggle
├── contexts/                   # SidebarContext (collapsed state, localStorage)
├── lib/
│   ├── prisma.ts               # Singleton PrismaClient
│   └── utils.ts                # Date helpers, SHIFT_COLORS, STATUS/ROLE/POSITION labels, cn()
├── store/
│   └── schedule.ts             # Zustand store for grid state
└── types/
    └── index.ts                # Prisma re-exports + ScheduleGridData type
```

## Key Patterns

### Schedule Grid (`src/components/schedule/ScheduleGrid.tsx`)
The central UI component. An interactive table with:
- Sticky header (thead) — fixed during vertical scroll (`sticky top-0 z-30`)
- Sticky left columns (사원번호, 사원명, 직위) — fixed during horizontal scroll (`sticky left-[N] z-10/z-40`)
- Max height container (`max-h-[calc(100vh-280px)] overflow-auto`) for both scroll axes
- Mouse drag selection + Shift+Click extend
- Ctrl+C/V copy/paste (tab-separated format)
- Per-nurse summary columns (D/E/N/T/X/O/XO) + extra stats (주말/연속/시간)
- Daily shift count footer rows (D/E/N/T/X, T+X, 일별 총인원)
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

### Dashboard (`src/app/dashboard/page.tsx`)
Server component that queries only CONFIRMED schedules for the current month. Shows today's shifts, week preview, fairness metrics, alerts (consecutive days ≥5, N→D violations), staff stats.

### Sorting
Nurses are sorted by `sortOrder` (not employeeNumber). This preserves the user-defined display order throughout the grid, dashboard, and all data views.

### Layout
- Collapsible sidebar (`SidebarContext` with localStorage persistence)
- Dark mode support (`next-themes`, class strategy)
- Responsive: sidebar collapses on mobile

## Path Alias

`@/*` → `src/*` (configured in tsconfig.json)

## Deployment

- Platform: Vercel
- Database: Vercel Postgres (Neon) — uses `DATABASE_URL` and `DATABASE_URL_UNPOOLED`
- Build: `prisma generate && prisma db push && next build`
