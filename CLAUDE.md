# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx prisma migrate dev --name <name>  # Create DB migration
npx prisma db push   # Sync schema without migration
npx prisma db seed   # Seed test data (prisma/seed.ts)
npx tsc --noEmit     # Type check
```

## Architecture

**Next.js 14 App Router** + **Prisma (SQLite)** + **Zustand** + **Tailwind CSS**

This is a hospital nurse scheduling management system (42병동 간호사 근무표 관리). All UI text is in Korean.

### Data Flow

```
Browser → Next.js API Routes (src/app/api/) → Prisma → SQLite (prisma/dev.db)
                                                ↕
Browser ← React Components ← Zustand Store (schedule grid state)
```

### Core Domain Model

- **Ward** → has many **Nurses** and **Schedules**
- **Schedule** (ward + year + month + version) → has many **ScheduleEntries** + **ScheduleSummaries**
- **ScheduleEntry** = one nurse's shift for one day (unique: scheduleId + nurseId + workDate)
- Schedule status flow: `DRAFT` → `CONFIRMED` (one confirmed per ward/month)

### Shift Codes

`D` (주간/Day), `E` (저녁/Evening), `N` (야간/Night), `T` (교육/Training), `O` (공휴/Holiday), `X` (휴무/Off), `B` (기타/Other)

### Nurse Positions (positionRank order)

`HN` (수간호사, rank 1), `CN` (책임간호사, rank 2), `AN` (주임간호사, rank 3), `RN` (일반간호사, rank 4)

## Key Patterns

### Schedule Grid (`src/components/schedule/ScheduleGrid.tsx`)
The central UI component. An interactive table with:
- Sticky columns (사원번호, 사원명, 직위)
- Mouse drag selection + Shift+Click extend
- Ctrl+C/V copy/paste (tab-separated format)
- Per-nurse summary columns (D/E/N/T/X/O/XO) + extra stats (주말/연속/시간)
- Daily shift count footer rows
- `NurseRow` is `memo()`-wrapped for performance

### Zustand Store (`src/store/schedule.ts`)
Client-side state for the schedule editing grid. Key fields:
- `gridData: ScheduleGridData[]` — all nurse rows with entries and summaries
- `isDirty: boolean` — unsaved changes flag
- `updateCells()` — batch update for paste operations, recalculates summaries inline

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

## Path Alias

`@/*` → `src/*` (configured in tsconfig.json)
