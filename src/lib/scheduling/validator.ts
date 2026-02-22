/**
 * 제약조건 검증
 */
import type { ScheduleState, ScheduleViolation, ShiftCode } from "@/types/scheduling";
import { getShift, countShiftOnDay } from "./state";
import { isWeekend } from "@/lib/korean-holidays";

export function validateSchedule(state: ScheduleState): ScheduleViolation[] {
  const violations: ScheduleViolation[] = [];
  const { grid, rnNurses, nurses, config, daysInMonth, previousContext, holidays } = state;

  const rnIds = rnNurses.map((n) => n.id);
  const nurseNameMap = new Map(nurses.map((n) => [n.id, n.name]));

  // === HARD Constraints ===

  // 1. 최소 인원 미달
  for (let d = 1; d <= daysInMonth; d++) {
    for (const shift of ["D", "E", "N"] as ShiftCode[]) {
      const count = countShiftOnDay(grid, rnIds, d, shift);
      const min = config.minStaff[shift as "D" | "E" | "N"];
      if (count < min) {
        violations.push({
          type: "HARD",
          category: "MIN_STAFF",
          message: `${d}일 ${shift} 근무: ${count}명 (최소 ${min}명 필요)`,
          day: d,
        });
      }
    }
  }

  for (const nurse of rnNurses) {
    const id = nurse.id;
    const name = nurseNameMap.get(id) || id;

    // 2. N→D 위반
    for (let d = 1; d < daysInMonth; d++) {
      if (getShift(grid, id, d) === "N") {
        const next = getShift(grid, id, d + 1);
        if (next === "D" || next === "E") {
          violations.push({
            type: "HARD",
            category: "NIGHT_TO_DAY",
            message: `${name}: ${d}일 N → ${d + 1}일 ${next} (N 후 D/E 배정 금지)`,
            nurseId: id,
            nurseName: name,
            day: d,
          });
        }
      }
    }
    // 1일 전날(이전월) N→D 체크
    if (previousContext.lastShiftCode[id] === "N") {
      const first = getShift(grid, id, 1);
      if (first === "D" || first === "E") {
        violations.push({
          type: "HARD",
          category: "NIGHT_TO_DAY",
          message: `${name}: 이전월 마지막 N → 1일 ${first} (N 후 D/E 배정 금지)`,
          nurseId: id,
          nurseName: name,
          day: 1,
        });
      }
    }

    // 3. 연속근무 >5일
    let consecutive = previousContext.consecutiveWorkDays[id] || 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const s = getShift(grid, id, d);
      if (s && s !== "O" && s !== "X") {
        consecutive++;
        if (consecutive > 5) {
          violations.push({
            type: "HARD",
            category: "CONSECUTIVE_WORK",
            message: `${name}: ${d}일 기준 연속 ${consecutive}일 근무 (최대 5일)`,
            nurseId: id,
            nurseName: name,
            day: d,
          });
        }
      } else {
        consecutive = 0;
      }
    }

    // 4. 연속야간 >3일
    let consecutiveNight = previousContext.consecutiveNightDays[id] || 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (getShift(grid, id, d) === "N") {
        consecutiveNight++;
        if (consecutiveNight > 3) {
          violations.push({
            type: "HARD",
            category: "CONSECUTIVE_NIGHT",
            message: `${name}: ${d}일 기준 연속 ${consecutiveNight}일 야간 (최대 3일)`,
            nurseId: id,
            nurseName: name,
            day: d,
          });
        }
      } else {
        consecutiveNight = 0;
      }
    }
  }

  // === SOFT Constraints ===

  // 5. 희망 위반
  for (const nurse of rnNurses) {
    const prefs = state.preferences.get(nurse.id);
    if (!prefs) continue;
    const name = nurseNameMap.get(nurse.id) || nurse.id;
    for (const pref of prefs) {
      const actual = getShift(grid, nurse.id, pref.day);
      if (actual !== pref.shiftCode) {
        violations.push({
          type: pref.priority === "MUST" ? "HARD" : "SOFT",
          category: "PREFERENCE",
          message: `${name}: ${pref.day}일 희망 ${pref.shiftCode} → 실제 ${actual || "미배정"} (${pref.priority})`,
          nurseId: nurse.id,
          nurseName: name,
          day: pref.day,
        });
      }
    }
  }

  // 6. 공정성 편차 (야간)
  const nightCounts = rnNurses.map((n) => {
    let c = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (getShift(grid, n.id, d) === "N") c++;
    }
    return c;
  });
  const nightMax = Math.max(...nightCounts);
  const nightMin = Math.min(...nightCounts);
  if (nightMax - nightMin > 2) {
    violations.push({
      type: "SOFT",
      category: "NIGHT_FAIRNESS",
      message: `야간 편차: 최대 ${nightMax}회 - 최소 ${nightMin}회 = ${nightMax - nightMin} (권장 ≤2)`,
    });
  }

  // 7. 주말 근무 공정성
  const weekendCounts = rnNurses.map((n) => {
    let c = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (isWeekend(config.year, config.month, d) || holidays.includes(d)) {
        const s = getShift(grid, n.id, d);
        if (s && s !== "O" && s !== "X") c++;
      }
    }
    return c;
  });
  const wkMax = Math.max(...weekendCounts);
  const wkMin = Math.min(...weekendCounts);
  if (wkMax - wkMin > 2) {
    violations.push({
      type: "SOFT",
      category: "WEEKEND_FAIRNESS",
      message: `주말근무 편차: 최대 ${wkMax}회 - 최소 ${wkMin}회 = ${wkMax - wkMin} (권장 ≤2)`,
    });
  }

  // 8. 연속 4~5일 근무 (soft warning)
  for (const nurse of rnNurses) {
    let consecutive = previousContext.consecutiveWorkDays[nurse.id] || 0;
    const name = nurseNameMap.get(nurse.id) || nurse.id;
    for (let d = 1; d <= daysInMonth; d++) {
      const s = getShift(grid, nurse.id, d);
      if (s && s !== "O" && s !== "X") {
        consecutive++;
        if (consecutive === 4 || consecutive === 5) {
          violations.push({
            type: "SOFT",
            category: "CONSECUTIVE_WORK_WARN",
            message: `${name}: ${d}일 기준 연속 ${consecutive}일 근무`,
            nurseId: nurse.id,
            nurseName: name,
            day: d,
          });
        }
      } else {
        consecutive = 0;
      }
    }
  }

  return violations;
}
