/** 근무 코드 */
export type ShiftCode = "D" | "E" | "N" | "O" | "X" | "T" | "B" | "";

/** 희망 우선순위 */
export type PreferencePriority = "MUST" | "STRONG" | "PREFER";

/** 일별 희망 근무 */
export interface DayPreference {
  day: number;
  shiftCode: ShiftCode;
  priority: PreferencePriority;
  reason?: string;
}

/** 간호사별 희망 근무 */
export interface NursePreferences {
  nurseId: string;
  preferences: DayPreference[];
}

/** 스케줄 생성 설정 */
export interface ScheduleGenerationConfig {
  year: number;
  month: number;
  /** 최소 인원 배치 (RN 기준) */
  minStaff: {
    D: number; // 주간 최소
    E: number; // 저녁 최소
    N: number; // 야간 최소
  };
  /** 최대 연속 근무일 */
  maxConsecutiveWork: number;
  /** 최대 연속 야간 근무일 */
  maxConsecutiveNight: number;
  /** 최소 월 오프일 */
  minMonthlyOff: number;
  /** SA 반복 횟수 */
  saIterations: number;
  /** SA 온도 감쇠율 */
  saCoolingRate: number;
}

/** 이전월 컨텍스트 (연속성) */
export interface PreviousMonthContext {
  /** 각 간호사의 월말 연속근무일수 */
  consecutiveWorkDays: Record<string, number>;
  /** 각 간호사의 월말 연속야간수 */
  consecutiveNightDays: Record<string, number>;
  /** 각 간호사의 마지막 근무 코드 */
  lastShiftCode: Record<string, ShiftCode>;
  /** 각 간호사의 이전월 N 횟수 */
  previousNightCount: Record<string, number>;
  /** 각 간호사의 이전월 주말근무 횟수 */
  previousWeekendWorkCount: Record<string, number>;
}

/** 간호사 정보 (알고리즘용) */
export interface ScheduleNurse {
  id: string;
  name: string;
  position: string;  // HN, CN, RN, AN
  sortOrder: number;
}

/** 알고리즘 내부 상태: 간호사별 일별 배정 */
export type ScheduleGrid = Record<string, Record<number, ShiftCode>>;

/** 스케줄 상태 (알고리즘 내부) */
export interface ScheduleState {
  grid: ScheduleGrid;
  daysInMonth: number;
  nurses: ScheduleNurse[];
  rnNurses: ScheduleNurse[];  // RN만
  config: ScheduleGenerationConfig;
  holidays: number[];
  preferences: Map<string, DayPreference[]>;
  previousContext: PreviousMonthContext;
}

/** 점수 항목별 결과 */
export interface ScoreBreakdown {
  preferenceScore: number;
  nightFairnessScore: number;
  weekendFairnessScore: number;
  consecutivePenalty: number;
  isolatedOffPenalty: number;
  previousBalanceScore: number;
  total: number;
}

/** 제약조건 위반 */
export interface ScheduleViolation {
  type: "HARD" | "SOFT";
  category: string;
  message: string;
  nurseId?: string;
  nurseName?: string;
  day?: number;
}

/** 간호사별 요약 통계 */
export interface NurseScheduleSummary {
  nurseId: string;
  nurseName: string;
  position: string;
  counts: Record<string, number>;
  weekendWorkDays: number;
  nightCount: number;
  maxConsecutive: number;
}

/** 최종 생성 결과 */
export interface ScheduleGenerationResult {
  /** 생성된 스케줄 그리드 */
  grid: ScheduleGrid;
  /** 점수 */
  score: ScoreBreakdown;
  /** 위반 사항 */
  violations: ScheduleViolation[];
  /** 간호사별 요약 */
  nurseSummaries: NurseScheduleSummary[];
  /** 메타데이터 */
  metadata: {
    generatedAt: string;
    iterations: number;
    earlyStop: boolean;
    hardViolations: number;
    softViolations: number;
  };
}

/** 스왑 연산 타입 */
export type SwapOperation =
  | { type: "SAME_DAY_SWAP"; day: number; nurse1: string; nurse2: string }
  | { type: "SAME_NURSE_SWAP"; nurseId: string; day1: number; day2: number }
  | { type: "SINGLE_REASSIGN"; nurseId: string; day: number; newShift: ShiftCode };
