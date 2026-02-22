/**
 * 스케줄 점수 함수
 */
import type { ScheduleState, ScoreBreakdown } from "@/types/scheduling";
import { getShift, countShiftForNurse, variance } from "./state";
import { isWeekend } from "@/lib/korean-holidays";

/** 가중치 */
const WEIGHTS = {
  preference: 10,
  nightFairness: 8,
  weekendFairness: 7,
  previousBalance: 6,
  consecutivePenalty: 5,
  isolatedOffPenalty: 3,
};

export function scoreSchedule(state: ScheduleState): ScoreBreakdown {
  const { grid, rnNurses, config, daysInMonth, previousContext, holidays } = state;

  let preferenceScore = 0;
  let nightFairnessScore = 0;
  let weekendFairnessScore = 0;
  let consecutivePenalty = 0;
  let isolatedOffPenalty = 0;
  let previousBalanceScore = 0;

  // === 1. 희망 반영 점수 ===
  for (const nurse of rnNurses) {
    const prefs = state.preferences.get(nurse.id);
    if (!prefs) continue;
    for (const pref of prefs) {
      const actual = getShift(grid, nurse.id, pref.day);
      if (actual === pref.shiftCode) {
        // 희망 충족 보너스
        switch (pref.priority) {
          case "MUST":
            preferenceScore += 100;
            break;
          case "STRONG":
            preferenceScore += 10;
            break;
          case "PREFER":
            preferenceScore += 5;
            break;
        }
      } else {
        // 위반 패널티
        if (pref.priority === "MUST") {
          preferenceScore -= 200;
        }
      }
    }
  }

  // === 2. 야간 공정성 ===
  const nightCounts = rnNurses.map((n) =>
    countShiftForNurse(grid, n.id, daysInMonth, "N")
  );
  nightFairnessScore = -variance(nightCounts) * WEIGHTS.nightFairness;

  // === 3. 주말 공정성 ===
  const weekendWorkCounts = rnNurses.map((n) => {
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (isWeekend(config.year, config.month, d) || holidays.includes(d)) {
        const s = getShift(grid, n.id, d);
        if (s && s !== "O" && s !== "X") count++;
      }
    }
    return count;
  });
  weekendFairnessScore = -variance(weekendWorkCounts) * WEIGHTS.weekendFairness;

  // === 4. 연속근무 패널티 ===
  for (const nurse of rnNurses) {
    let consecutive = previousContext.consecutiveWorkDays[nurse.id] || 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const s = getShift(grid, nurse.id, d);
      if (s && s !== "O" && s !== "X") {
        consecutive++;
        if (consecutive > 3) {
          consecutivePenalty -= (consecutive - 3) ** 2;
        }
      } else {
        consecutive = 0;
      }
    }
  }
  consecutivePenalty *= WEIGHTS.consecutivePenalty;

  // === 5. 고립 오프 패널티 ===
  for (const nurse of rnNurses) {
    for (let d = 2; d < daysInMonth; d++) {
      const s = getShift(grid, nurse.id, d);
      if (s === "O" || s === "X") {
        const prev = getShift(grid, nurse.id, d - 1);
        const next = getShift(grid, nurse.id, d + 1);
        const prevIsWork = prev && prev !== "O" && prev !== "X";
        const nextIsWork = next && next !== "O" && next !== "X";
        if (prevIsWork && nextIsWork) {
          isolatedOffPenalty -= 1;
        }
      }
    }
  }
  isolatedOffPenalty *= WEIGHTS.isolatedOffPenalty;

  // === 6. 이전월 균형 ===
  const cumulativeNightCounts = rnNurses.map((n) => {
    const current = countShiftForNurse(grid, n.id, daysInMonth, "N");
    const previous = previousContext.previousNightCount[n.id] || 0;
    return current + previous;
  });
  previousBalanceScore = -variance(cumulativeNightCounts) * WEIGHTS.previousBalance;

  const total =
    preferenceScore * WEIGHTS.preference +
    nightFairnessScore +
    weekendFairnessScore +
    consecutivePenalty +
    isolatedOffPenalty +
    previousBalanceScore;

  return {
    preferenceScore,
    nightFairnessScore,
    weekendFairnessScore,
    consecutivePenalty,
    isolatedOffPenalty,
    previousBalanceScore,
    total,
  };
}
