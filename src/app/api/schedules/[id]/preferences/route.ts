import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/schedules/[id]/preferences
 * 해당 스케줄 월의 모든 희망 근무 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: params.id },
    select: { wardId: true, year: true, month: true },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  // 해당 병동의 모든 간호사 희망 조회
  const wardNurses = await prisma.nurse.findMany({
    where: { wardId: schedule.wardId, employmentStatus: "ACTIVE" },
    select: { id: true },
  });

  const preferences = await prisma.nursePreference.findMany({
    where: {
      nurseId: { in: wardNurses.map((n) => n.id) },
      year: schedule.year,
      month: schedule.month,
    },
    include: {
      nurse: {
        select: { id: true, name: true, employeeNumber: true, position: true },
      },
    },
    orderBy: [{ nurseId: "asc" }, { day: "asc" }],
  });

  return NextResponse.json(preferences);
}

/**
 * POST /api/schedules/[id]/preferences
 * 간호사별 희망 일괄 저장/수정 (upsert)
 *
 * Body: {
 *   nurseId: string,
 *   preferences: { day: number, shiftCode: string, priority: string, reason?: string }[]
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      select: { wardId: true, year: true, month: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const body = await request.json();
    const { nurseId, preferences } = body;

    if (!nurseId || !Array.isArray(preferences)) {
      return NextResponse.json(
        { error: "Required: nurseId, preferences[]" },
        { status: 400 }
      );
    }

    // 기존 해당 간호사의 해당 월 희망 삭제 후 새로 삽입
    await prisma.nursePreference.deleteMany({
      where: {
        nurseId,
        year: schedule.year,
        month: schedule.month,
      },
    });

    // 유효한 희망만 삽입
    const validPrefs = preferences.filter(
      (p: { day: number; shiftCode: string }) => p.day >= 1 && p.day <= 31 && p.shiftCode
    );

    if (validPrefs.length > 0) {
      await prisma.nursePreference.createMany({
        data: validPrefs.map((p: { day: number; shiftCode: string; priority?: string; reason?: string }) => ({
          nurseId,
          year: schedule.year,
          month: schedule.month,
          day: p.day,
          shiftCode: p.shiftCode,
          priority: p.priority || "PREFER",
          reason: p.reason || null,
        })),
      });
    }

    // 저장된 결과 반환
    const saved = await prisma.nursePreference.findMany({
      where: {
        nurseId,
        year: schedule.year,
        month: schedule.month,
      },
      orderBy: { day: "asc" },
    });

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to save preferences:", error);
    return NextResponse.json(
      { error: "희망 근무 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
