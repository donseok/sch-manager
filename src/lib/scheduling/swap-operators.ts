/**
 * Simulated Annealing 스왑 연산자
 */
import type { ScheduleState, SwapOperation, ShiftCode } from "@/types/scheduling";
import { getShift } from "./state";

const WORK_SHIFTS: ShiftCode[] = ["D", "E", "N"];

/**
 * 랜덤 스왑 연산 생성
 */
export function generateSwapOperation(state: ScheduleState): SwapOperation | null {
  const { rnNurses } = state;
  if (rnNurses.length < 2) return null;

  const opType = Math.random();

  if (opType < 0.4) {
    // 같은 날 두 간호사 교환
    return generateSameDaySwap(state);
  } else if (opType < 0.7) {
    // 한 간호사 이틀 교환
    return generateSameNurseSwap(state);
  } else {
    // 단일 재배정
    return generateSingleReassign(state);
  }
}

function generateSameDaySwap(state: ScheduleState): SwapOperation | null {
  const { rnNurses, daysInMonth, grid } = state;
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const day = Math.floor(Math.random() * daysInMonth) + 1;
    const idx1 = Math.floor(Math.random() * rnNurses.length);
    let idx2 = Math.floor(Math.random() * (rnNurses.length - 1));
    if (idx2 >= idx1) idx2++;

    const nurse1 = rnNurses[idx1].id;
    const nurse2 = rnNurses[idx2].id;

    const shift1 = getShift(grid, nurse1, day);
    const shift2 = getShift(grid, nurse2, day);

    // 다른 근무여야 교환 의미 있음
    if (shift1 === shift2) continue;
    // 둘 다 배정되어 있어야 함
    if (!shift1 || !shift2) continue;

    return { type: "SAME_DAY_SWAP", day, nurse1, nurse2 };
  }
  return null;
}

function generateSameNurseSwap(state: ScheduleState): SwapOperation | null {
  const { rnNurses, daysInMonth, grid } = state;
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const nurse = rnNurses[Math.floor(Math.random() * rnNurses.length)];
    const day1 = Math.floor(Math.random() * daysInMonth) + 1;
    const day2 = Math.floor(Math.random() * daysInMonth) + 1;

    if (day1 === day2) continue;

    const shift1 = getShift(grid, nurse.id, day1);
    const shift2 = getShift(grid, nurse.id, day2);

    if (shift1 === shift2) continue;
    if (!shift1 || !shift2) continue;

    return { type: "SAME_NURSE_SWAP", nurseId: nurse.id, day1, day2 };
  }
  return null;
}

function generateSingleReassign(state: ScheduleState): SwapOperation | null {
  const { rnNurses, daysInMonth, grid } = state;
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const nurse = rnNurses[Math.floor(Math.random() * rnNurses.length)];
    const day = Math.floor(Math.random() * daysInMonth) + 1;
    const currentShift = getShift(grid, nurse.id, day);

    if (!currentShift) continue;

    // 새로운 근무 선택 (현재와 다른)
    const candidates = [...WORK_SHIFTS, "O" as ShiftCode, "X" as ShiftCode].filter(
      (s) => s !== currentShift
    );
    const newShift = candidates[Math.floor(Math.random() * candidates.length)];

    return { type: "SINGLE_REASSIGN", nurseId: nurse.id, day, newShift };
  }
  return null;
}

/**
 * 스왑 연산 적용 (직접 grid 변경)
 * @returns 복원용 역연산 정보
 */
export function applySwap(
  state: ScheduleState,
  op: SwapOperation
): { undo: () => void } | null {
  const { grid } = state;

  switch (op.type) {
    case "SAME_DAY_SWAP": {
      const s1 = getShift(grid, op.nurse1, op.day);
      const s2 = getShift(grid, op.nurse2, op.day);

      grid[op.nurse1][op.day] = s2;
      grid[op.nurse2][op.day] = s1;

      return {
        undo: () => {
          grid[op.nurse1][op.day] = s1;
          grid[op.nurse2][op.day] = s2;
        },
      };
    }

    case "SAME_NURSE_SWAP": {
      const s1 = getShift(grid, op.nurseId, op.day1);
      const s2 = getShift(grid, op.nurseId, op.day2);

      grid[op.nurseId][op.day1] = s2;
      grid[op.nurseId][op.day2] = s1;

      return {
        undo: () => {
          grid[op.nurseId][op.day1] = s1;
          grid[op.nurseId][op.day2] = s2;
        },
      };
    }

    case "SINGLE_REASSIGN": {
      const oldShift = getShift(grid, op.nurseId, op.day);
      grid[op.nurseId][op.day] = op.newShift;

      return {
        undo: () => {
          grid[op.nurseId][op.day] = oldShift;
        },
      };
    }
  }
}
