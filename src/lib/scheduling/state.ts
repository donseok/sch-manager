/**
 * 스케줄 상태 관리 헬퍼
 */
import type { ShiftCode, ScheduleGrid, ScheduleState } from "@/types/scheduling";

/** 특정 간호사의 특정 일 근무를 배정 */
export function assign(
  grid: ScheduleGrid,
  nurseId: string,
  day: number,
  shift: ShiftCode
): void {
  if (!grid[nurseId]) grid[nurseId] = {};
  grid[nurseId][day] = shift;
}

/** 특정 간호사의 특정 일 근무가 배정되어 있는지 확인 */
export function isAssigned(grid: ScheduleGrid, nurseId: string, day: number): boolean {
  return !!grid[nurseId]?.[day];
}

/** 특정 간호사의 특정 일 근무코드 조회 */
export function getShift(grid: ScheduleGrid, nurseId: string, day: number): ShiftCode {
  return (grid[nurseId]?.[day] as ShiftCode) || "";
}

/** 특정 일의 특정 근무에 배정된 간호사 수 */
export function countShiftOnDay(
  grid: ScheduleGrid,
  nurseIds: string[],
  day: number,
  shift: ShiftCode
): number {
  return nurseIds.filter((id) => getShift(grid, id, day) === shift).length;
}

/** 특정 간호사의 월간 특정 근무 횟수 */
export function countShiftForNurse(
  grid: ScheduleGrid,
  nurseId: string,
  daysInMonth: number,
  shift: ShiftCode
): number {
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (getShift(grid, nurseId, d) === shift) count++;
  }
  return count;
}

/** 특정 간호사의 월간 오프 횟수 (O + X) */
export function countOffDays(
  grid: ScheduleGrid,
  nurseId: string,
  daysInMonth: number
): number {
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const s = getShift(grid, nurseId, d);
    if (s === "O" || s === "X") count++;
  }
  return count;
}

/** 특정 일에 오프인 RN 수 */
export function countOffOnDay(
  grid: ScheduleGrid,
  nurseIds: string[],
  day: number
): number {
  return nurseIds.filter((id) => {
    const s = getShift(grid, id, day);
    return s === "O" || s === "X";
  }).length;
}

/** 야간(N) 배정 가능 여부 확인 */
export function canAssignNight(
  state: ScheduleState,
  nurseId: string,
  day: number
): boolean {
  const { grid, config, previousContext, daysInMonth } = state;

  // 이미 배정되어 있으면 불가
  if (isAssigned(grid, nurseId, day)) return false;

  // N 다음날은 근무 불가 (D 또는 E 안됨) - 역으로, 전날이 D/E면 N 배정 불가? 아니, N→D는 금지지만 D→N은 가능
  // N 뒤에 자동 오프를 줘야 하므로 day+1이 이미 D/E로 배정되었으면 불가
  if (day < daysInMonth) {
    const nextShift = getShift(grid, nurseId, day + 1);
    if (nextShift === "D" || nextShift === "E") return false;
  }

  // 전날이 D/E인 경우 → N 배정 가능 (D→N, E→N은 허용)
  // 전날이 N인 경우 → 연속 야간 체크
  let consecutiveNights = 0;
  for (let d = day - 1; d >= 1; d--) {
    if (getShift(grid, nurseId, d) === "N") {
      consecutiveNights++;
    } else {
      break;
    }
  }
  // 이전월 연속야간 포함
  if (day - 1 - consecutiveNights < 1) {
    consecutiveNights += previousContext.consecutiveNightDays[nurseId] || 0;
  }
  if (consecutiveNights >= config.maxConsecutiveNight) return false;

  // 연속근무 체크
  let consecutiveWork = 0;
  for (let d = day - 1; d >= 1; d--) {
    const s = getShift(grid, nurseId, d);
    if (s && s !== "O" && s !== "X") {
      consecutiveWork++;
    } else {
      break;
    }
  }
  if (day - 1 - consecutiveWork < 1) {
    consecutiveWork += previousContext.consecutiveWorkDays[nurseId] || 0;
  }
  if (consecutiveWork >= config.maxConsecutiveWork) return false;

  return true;
}

/** 근무 배정 가능 여부 (일반) */
export function canAssignWork(
  state: ScheduleState,
  nurseId: string,
  day: number
): boolean {
  const { grid, config, previousContext } = state;

  if (isAssigned(grid, nurseId, day)) return false;

  // N→D 위반 체크: 전날 N이면 D/E 배정 불가
  if (day > 1) {
    const prevShift = getShift(grid, nurseId, day - 1);
    if (prevShift === "N") return false;
  } else {
    // 이전월 마지막 근무가 N이면 1일에 D/E 불가
    if (previousContext.lastShiftCode[nurseId] === "N") return false;
  }

  // 연속근무 체크
  let consecutiveWork = 0;
  for (let d = day - 1; d >= 1; d--) {
    const s = getShift(grid, nurseId, d);
    if (s && s !== "O" && s !== "X") {
      consecutiveWork++;
    } else {
      break;
    }
  }
  if (day - 1 - consecutiveWork < 1) {
    consecutiveWork += previousContext.consecutiveWorkDays[nurseId] || 0;
  }
  if (consecutiveWork >= config.maxConsecutiveWork) return false;

  return true;
}

/** 스케줄 그리드 깊은 복사 */
export function cloneGrid(grid: ScheduleGrid): ScheduleGrid {
  const copy: ScheduleGrid = {};
  for (const nurseId of Object.keys(grid)) {
    copy[nurseId] = { ...grid[nurseId] };
  }
  return copy;
}

/** 배열의 분산 계산 */
export function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}
