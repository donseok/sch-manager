/**
 * 6단계 스케줄 생성 알고리즘
 *
 * Phase 1: 고정 배정 (HN/CN)
 * Phase 2: 오프 배분
 * Phase 3: 야간(N) 배정
 * Phase 4: 저녁(E) 배정
 * Phase 5: 주간(D) 채움
 * Phase 6: SA 최적화
 */
import type {
  ScheduleGenerationConfig,
  ScheduleNurse,
  NursePreferences,
  PreviousMonthContext,
  ScheduleState,
  ScheduleGenerationResult,
  ScheduleGrid,
  DayPreference,
  NurseScheduleSummary,
} from "@/types/scheduling";
import { getDaysInMonth } from "@/lib/utils";
import { getKoreanHolidays, isWeekend } from "@/lib/korean-holidays";
import {
  assign,
  isAssigned,
  getShift,
  countShiftOnDay,
  countShiftForNurse,
  countOffDays,
  countOffOnDay,
  canAssignNight,
  canAssignWork,
} from "./state";
import { scoreSchedule } from "./scorer";
import { validateSchedule } from "./validator";
import { generateSwapOperation, applySwap } from "./swap-operators";

/** 기본 설정 */
export const DEFAULT_CONFIG: ScheduleGenerationConfig = {
  year: 2026,
  month: 3,
  minStaff: { D: 3, E: 3, N: 2 },
  maxConsecutiveWork: 5,
  maxConsecutiveNight: 3,
  minMonthlyOff: 8,
  saIterations: 5000,
  saCoolingRate: 0.995,
};

/** 빈 이전월 컨텍스트 */
function emptyPreviousContext(): PreviousMonthContext {
  return {
    consecutiveWorkDays: {},
    consecutiveNightDays: {},
    lastShiftCode: {},
    previousNightCount: {},
    previousWeekendWorkCount: {},
  };
}

/**
 * 메인 생성 함수
 */
export function generateSchedule(
  nurses: ScheduleNurse[],
  config: ScheduleGenerationConfig,
  allPreferences: NursePreferences[],
  previousContext?: PreviousMonthContext
): ScheduleGenerationResult {
  const daysInMonth = getDaysInMonth(config.year, config.month);
  const holidays = getKoreanHolidays(config.year, config.month);
  const prev = previousContext || emptyPreviousContext();

  // 간호사 분류
  const rnNurses = nurses.filter((n) => n.position !== "HN" && n.position !== "CN");
  const leaderNurses = nurses.filter((n) => n.position === "HN" || n.position === "CN");

  // 희망 맵
  const preferencesMap = new Map<string, DayPreference[]>();
  for (const np of allPreferences) {
    preferencesMap.set(np.nurseId, np.preferences);
  }

  // 초기 상태
  const grid: ScheduleGrid = {};
  for (const nurse of nurses) {
    grid[nurse.id] = {};
  }

  const state: ScheduleState = {
    grid,
    daysInMonth,
    nurses,
    rnNurses,
    config,
    holidays,
    preferences: preferencesMap,
    previousContext: prev,
  };

  // === Phase 1: 고정 배정 ===
  phaseFixedAssignment(state, leaderNurses);

  // === Phase 2: 오프 배분 ===
  phaseOffDistribution(state);

  // === Phase 3: 야간(N) 배정 ===
  phaseNightAssignment(state);

  // === Phase 4: 저녁(E) 배정 ===
  phaseEveningAssignment(state);

  // === Phase 5: 주간(D) 채움 ===
  phaseDayFill(state);

  // === Phase 6: SA 최적화 ===
  const { iterations, earlyStop } = phaseOptimization(state);

  // 결과 생성
  const score = scoreSchedule(state);
  const violations = validateSchedule(state);
  const nurseSummaries = buildNurseSummaries(state);

  return {
    grid: state.grid,
    score,
    violations,
    nurseSummaries,
    metadata: {
      generatedAt: new Date().toISOString(),
      iterations,
      earlyStop,
      hardViolations: violations.filter((v) => v.type === "HARD").length,
      softViolations: violations.filter((v) => v.type === "SOFT").length,
    },
  };
}

// ============================================================
// Phase 1: 고정 배정
// ============================================================
function phaseFixedAssignment(state: ScheduleState, leaders: ScheduleNurse[]) {
  const { grid, daysInMonth, config, holidays } = state;

  for (const nurse of leaders) {
    for (let d = 1; d <= daysInMonth; d++) {
      const weekend = isWeekend(config.year, config.month, d);
      const holiday = holidays.includes(d);
      assign(grid, nurse.id, d, weekend || holiday ? "O" : "D");
    }
  }

  // MUST 우선순위 희망 적용 (RN)
  for (const nurse of state.rnNurses) {
    const prefs = state.preferences.get(nurse.id);
    if (!prefs) continue;
    for (const pref of prefs) {
      if (pref.priority === "MUST") {
        assign(grid, nurse.id, pref.day, pref.shiftCode);
      }
    }
  }
}

// ============================================================
// Phase 2: 오프 배분
// ============================================================
function phaseOffDistribution(state: ScheduleState) {
  const { grid, rnNurses, config, daysInMonth, holidays } = state;
  const rnCount = rnNurses.length;
  const minOff = config.minMonthlyOff;

  // 하루 최대 오프 인원 = rnCount - (D_min + E_min + N_min)
  const minWorkPerDay = config.minStaff.D + config.minStaff.E + config.minStaff.N;
  const maxOffPerDay = Math.max(rnCount - minWorkPerDay, 0);

  // 주말/공휴일 오프 공정 배분
  const weekendHolidayDays: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (isWeekend(config.year, config.month, d) || holidays.includes(d)) {
      weekendHolidayDays.push(d);
    }
  }

  // RN별 주말오프 카운트 (공정성 추적)
  const rnWeekendOffCount = new Map<string, number>();
  for (const nurse of rnNurses) {
    rnWeekendOffCount.set(nurse.id, 0);
  }

  // 주말/공휴일에 오프 배분
  for (const day of weekendHolidayDays) {
    // 이미 MUST로 배정된 간호사 제외
    const unassigned = rnNurses.filter((n) => !isAssigned(grid, n.id, day));
    if (unassigned.length === 0) continue;

    // 주말오프가 적은 순서대로 정렬
    unassigned.sort((a, b) => {
      return (rnWeekendOffCount.get(a.id) || 0) - (rnWeekendOffCount.get(b.id) || 0);
    });

    // 오프 배정 (최대 maxOffPerDay명 - 이미 오프인 수)
    const alreadyOff = rnNurses.filter((n) => {
      const s = getShift(grid, n.id, day);
      return s === "O" || s === "X";
    }).length;
    const slotsAvailable = Math.max(maxOffPerDay - alreadyOff, 0);

    for (let i = 0; i < Math.min(slotsAvailable, unassigned.length); i++) {
      const nurse = unassigned[i];
      // 희망 확인
      const pref = state.preferences.get(nurse.id)?.find((p) => p.day === day);
      if (pref && pref.shiftCode !== "O" && pref.shiftCode !== "X" && pref.priority === "STRONG") {
        continue; // 강력히 근무 희망하면 건너뜀
      }
      assign(grid, nurse.id, day, "O");
      rnWeekendOffCount.set(nurse.id, (rnWeekendOffCount.get(nurse.id) || 0) + 1);
    }
  }

  // 평일 잔여 오프 배분 (최소 오프일 충족)
  const weekdays: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (!isWeekend(config.year, config.month, d) && !holidays.includes(d)) {
      weekdays.push(d);
    }
  }

  for (const nurse of rnNurses) {
    const currentOff = countOffDays(grid, nurse.id, daysInMonth);
    let needed = minOff - currentOff;

    if (needed <= 0) continue;

    // 미배정 평일 중 오프 배정 (연속 오프 선호)
    const unassignedDays = weekdays.filter((d) => !isAssigned(grid, nurse.id, d));

    // 이미 오프가 있는 날 근처 평일 선호 (그룹핑)
    const scored = unassignedDays.map((d) => {
      let adjacencyScore = 0;
      if (d > 1) {
        const prev = getShift(grid, nurse.id, d - 1);
        if (prev === "O" || prev === "X") adjacencyScore += 2;
      }
      if (d < daysInMonth) {
        const next = getShift(grid, nurse.id, d + 1);
        if (next === "O" || next === "X") adjacencyScore += 2;
      }
      // 희망 오프 보너스
      const pref = state.preferences.get(nurse.id)?.find((p) => p.day === d);
      if (pref && (pref.shiftCode === "O" || pref.shiftCode === "X")) {
        adjacencyScore += pref.priority === "STRONG" ? 5 : 3;
      }
      // 해당 일 오프 인원이 많으면 감점
      const offCount = countOffOnDay(grid, rnNurses.map((n) => n.id), d);
      adjacencyScore -= offCount;
      return { day: d, score: adjacencyScore };
    });

    scored.sort((a, b) => b.score - a.score);

    for (const { day } of scored) {
      if (needed <= 0) break;
      // 하루 최대 오프 인원 체크
      const dayOffCount = countOffOnDay(grid, rnNurses.map((n) => n.id), day);
      if (dayOffCount >= maxOffPerDay) continue;
      assign(grid, nurse.id, day, "X");
      needed--;
    }
  }
}

// ============================================================
// Phase 3: 야간(N) 배정
// ============================================================
function phaseNightAssignment(state: ScheduleState) {
  const { grid, rnNurses, config, daysInMonth, previousContext } = state;
  const targetN = config.minStaff.N; // 일 2명

  // 목표 N 횟수 계산: (daysInMonth * targetN) / rnCount
  const totalNSlots = daysInMonth * targetN;
  const targetPerNurse = totalNSlots / rnNurses.length;
  const _minTarget = Math.floor(targetPerNurse);
  const maxTarget = Math.ceil(targetPerNurse);

  for (let d = 1; d <= daysInMonth; d++) {
    // 이미 N이 배정된 수
    const currentN = countShiftOnDay(grid, rnNurses.map((n) => n.id), d, "N");
    const needed = targetN - currentN;

    if (needed <= 0) continue;

    // 후보 점수 계산
    const candidates = rnNurses
      .filter((n) => canAssignNight(state, n.id, d))
      .map((n) => {
        let score = 0;

        // N 부족도: 목표보다 적게 한 간호사에 가산
        const nurseNCount = countShiftForNurse(grid, n.id, daysInMonth, "N");
        score += (maxTarget - nurseNCount) * 10;

        // 이전월 N 횟수 고려
        const prevN = previousContext.previousNightCount[n.id] || 0;
        score -= prevN * 2;

        // 희망 일치
        const pref = state.preferences.get(n.id)?.find((p) => p.day === d);
        if (pref?.shiftCode === "N") {
          score += pref.priority === "STRONG" ? 20 : 10;
        }
        if (pref?.shiftCode === "O" || pref?.shiftCode === "X") {
          score -= pref.priority === "STRONG" ? 15 : 5;
        }

        // 약간의 랜덤성
        score += Math.random() * 3;

        return { nurse: n, score };
      })
      .sort((a, b) => b.score - a.score);

    // 상위 needed명 배정
    for (let i = 0; i < Math.min(needed, candidates.length); i++) {
      const n = candidates[i].nurse;
      assign(grid, n.id, d, "N");

      // N 블록 후 자동 오프 (다음날이 미배정이면)
      if (d < daysInMonth && !isAssigned(grid, n.id, d + 1)) {
        assign(grid, n.id, d + 1, "O");
      }
    }
  }
}

// ============================================================
// Phase 4: 저녁(E) 배정
// ============================================================
function phaseEveningAssignment(state: ScheduleState) {
  const { grid, rnNurses, config, daysInMonth } = state;
  const targetE = config.minStaff.E; // 일 3명

  for (let d = 1; d <= daysInMonth; d++) {
    const currentE = countShiftOnDay(grid, rnNurses.map((n) => n.id), d, "E");
    const needed = targetE - currentE;

    if (needed <= 0) continue;

    const candidates = rnNurses
      .filter((n) => !isAssigned(grid, n.id, d) && canAssignWork(state, n.id, d))
      .map((n) => {
        let score = 0;

        // E 부족도
        const nurseECount = countShiftForNurse(grid, n.id, daysInMonth, "E");
        const targetPerNurse = (daysInMonth * targetE) / rnNurses.length;
        score += (targetPerNurse - nurseECount) * 5;

        // 희망 일치
        const pref = state.preferences.get(n.id)?.find((p) => p.day === d);
        if (pref?.shiftCode === "E") {
          score += pref.priority === "STRONG" ? 20 : 10;
        }

        // 랜덤성
        score += Math.random() * 3;

        return { nurse: n, score };
      })
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < Math.min(needed, candidates.length); i++) {
      assign(grid, candidates[i].nurse.id, d, "E");
    }
  }
}

// ============================================================
// Phase 5: 주간(D) 채움
// ============================================================
function phaseDayFill(state: ScheduleState) {
  const { grid, rnNurses, daysInMonth } = state;

  for (const nurse of rnNurses) {
    for (let d = 1; d <= daysInMonth; d++) {
      if (!isAssigned(grid, nurse.id, d)) {
        // canAssignWork 체크
        if (canAssignWork(state, nurse.id, d)) {
          assign(grid, nurse.id, d, "D");
        } else {
          // 연속근무 제한 등으로 근무 불가 → 오프 배정
          assign(grid, nurse.id, d, "X");
        }
      }
    }
  }
}

// ============================================================
// Phase 6: SA 최적화
// ============================================================
function phaseOptimization(state: ScheduleState): { iterations: number; earlyStop: boolean } {
  const { config } = state;
  let currentScore = scoreSchedule(state).total;
  let temperature = 100;
  let noImproveCount = 0;
  let totalIterations = 0;

  for (let i = 0; i < config.saIterations; i++) {
    totalIterations = i + 1;

    const op = generateSwapOperation(state);
    if (!op) continue;

    const result = applySwap(state, op);
    if (!result) continue;

    const newScore = scoreSchedule(state).total;
    const delta = newScore - currentScore;

    if (delta > 0) {
      // 개선: 수용
      currentScore = newScore;
      noImproveCount = 0;
    } else {
      // 악화: 확률적 수용 (SA)
      const probability = Math.exp(delta / temperature);
      if (Math.random() < probability) {
        currentScore = newScore;
      } else {
        // 복원
        result.undo();
      }
      noImproveCount++;
    }

    temperature *= config.saCoolingRate;

    // 조기 종료: 100회 무개선
    if (noImproveCount >= 100) {
      return { iterations: totalIterations, earlyStop: true };
    }
  }

  return { iterations: totalIterations, earlyStop: false };
}

// ============================================================
// 결과 요약 생성
// ============================================================
function buildNurseSummaries(state: ScheduleState): NurseScheduleSummary[] {
  const { grid, nurses, config, daysInMonth, holidays } = state;

  return nurses.map((nurse) => {
    const counts: Record<string, number> = { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0 };
    let weekendWorkDays = 0;
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const s = getShift(grid, nurse.id, d);
      if (s && s in counts) {
        counts[s]++;
      }

      const isWork = s && s !== "O" && s !== "X";
      if (isWork) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }

      if (isWork && (isWeekend(config.year, config.month, d) || holidays.includes(d))) {
        weekendWorkDays++;
      }
    }

    return {
      nurseId: nurse.id,
      nurseName: nurse.name,
      position: nurse.position,
      counts,
      weekendWorkDays,
      nightCount: counts.N,
      maxConsecutive,
    };
  });
}
