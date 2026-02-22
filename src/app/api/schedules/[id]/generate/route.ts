import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSchedule, DEFAULT_CONFIG } from "@/lib/scheduling";
import type {
  ScheduleNurse,
  NursePreferences,
  PreviousMonthContext,
  ShiftCode,
} from "@/types/scheduling";
import { getDaysInMonth } from "@/lib/utils";

/**
 * POST /api/schedules/[id]/generate
 * AI 스케줄 생성 (미리보기용, DB 저장하지 않음)
 *
 * Body (optional): {
 *   minStaff?: { D: number, E: number, N: number },
 *   maxConsecutiveWork?: number,
 *   maxConsecutiveNight?: number,
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 스케줄 로드
    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      select: { id: true, wardId: true, year: true, month: true, status: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // 2. 설정 파싱
    let bodyConfig = {};
    try {
      bodyConfig = await request.json();
    } catch {
      // body 없어도 OK
    }

    const config = {
      ...DEFAULT_CONFIG,
      year: schedule.year,
      month: schedule.month,
      ...(bodyConfig as Record<string, unknown>),
    };

    // 3. 간호사 목록 조회
    const wardNurses = await prisma.nurse.findMany({
      where: { wardId: schedule.wardId, employmentStatus: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
    });

    const nurses: ScheduleNurse[] = wardNurses.map((n) => ({
      id: n.id,
      name: n.name,
      position: n.position,
      sortOrder: n.sortOrder,
    }));

    // 4. 희망 근무 로드
    const rawPreferences = await prisma.nursePreference.findMany({
      where: {
        nurseId: { in: wardNurses.map((n) => n.id) },
        year: schedule.year,
        month: schedule.month,
      },
    });

    const preferencesMap = new Map<string, NursePreferences>();
    for (const pref of rawPreferences) {
      if (!preferencesMap.has(pref.nurseId)) {
        preferencesMap.set(pref.nurseId, {
          nurseId: pref.nurseId,
          preferences: [],
        });
      }
      preferencesMap.get(pref.nurseId)!.preferences.push({
        day: pref.day,
        shiftCode: pref.shiftCode as ShiftCode,
        priority: pref.priority as "MUST" | "STRONG" | "PREFER",
        reason: pref.reason || undefined,
      });
    }

    const allPreferences = Array.from(preferencesMap.values());

    // 5. 이전월 데이터 로드
    let prevYear = schedule.year;
    let prevMonth = schedule.month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const previousContext = await loadPreviousContext(
      schedule.wardId,
      prevYear,
      prevMonth,
      wardNurses.map((n) => n.id)
    );

    // 6. 알고리즘 실행
    const result = generateSchedule(nurses, config, allPreferences, previousContext);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to generate schedule:", error);
    return NextResponse.json(
      { error: "스케줄 생성에 실패했습니다.", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 이전월 컨텍스트 로드
 */
async function loadPreviousContext(
  wardId: string,
  prevYear: number,
  prevMonth: number,
  nurseIds: string[]
): Promise<PreviousMonthContext> {
  const context: PreviousMonthContext = {
    consecutiveWorkDays: {},
    consecutiveNightDays: {},
    lastShiftCode: {},
    previousNightCount: {},
    previousWeekendWorkCount: {},
  };

  // 이전월 스케줄 찾기
  const prevSchedule = await prisma.schedule.findFirst({
    where: {
      wardId,
      year: prevYear,
      month: prevMonth,
    },
    orderBy: { version: "desc" },
    include: {
      entries: {
        where: { nurseId: { in: nurseIds } },
        orderBy: { workDate: "asc" },
      },
      summaries: {
        where: { nurseId: { in: nurseIds } },
      },
    },
  });

  if (!prevSchedule) return context;

  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  // 간호사별 이전월 엔트리 정리
  const nurseEntries = new Map<string, Map<number, string>>();
  for (const entry of prevSchedule.entries) {
    const day = new Date(entry.workDate).getDate();
    if (!nurseEntries.has(entry.nurseId)) {
      nurseEntries.set(entry.nurseId, new Map());
    }
    nurseEntries.get(entry.nurseId)!.set(day, entry.shiftTypeCode);
  }

  for (const nurseId of nurseIds) {
    const entries = nurseEntries.get(nurseId);
    if (!entries) continue;

    // 마지막 근무 코드
    const lastDayShift = entries.get(daysInPrevMonth);
    if (lastDayShift) {
      context.lastShiftCode[nurseId] = lastDayShift as ShiftCode;
    }

    // 월말 연속근무일수
    let consecutiveWork = 0;
    for (let d = daysInPrevMonth; d >= 1; d--) {
      const s = entries.get(d);
      if (s && s !== "O" && s !== "X") {
        consecutiveWork++;
      } else {
        break;
      }
    }
    context.consecutiveWorkDays[nurseId] = consecutiveWork;

    // 월말 연속야간수
    let consecutiveNight = 0;
    for (let d = daysInPrevMonth; d >= 1; d--) {
      if (entries.get(d) === "N") {
        consecutiveNight++;
      } else {
        break;
      }
    }
    context.consecutiveNightDays[nurseId] = consecutiveNight;

    // 이전월 N 횟수
    const summary = prevSchedule.summaries.find((s) => s.nurseId === nurseId);
    context.previousNightCount[nurseId] = summary?.countN || 0;

    // 이전월 주말근무 횟수
    let weekendWork = 0;
    for (let d = 1; d <= daysInPrevMonth; d++) {
      const dow = new Date(prevYear, prevMonth - 1, d).getDay();
      if (dow === 0 || dow === 6) {
        const s = entries.get(d);
        if (s && s !== "O" && s !== "X") weekendWork++;
      }
    }
    context.previousWeekendWorkCount[nurseId] = weekendWork;
  }

  return context;
}
