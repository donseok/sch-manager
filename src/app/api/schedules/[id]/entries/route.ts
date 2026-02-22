import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entries = await prisma.scheduleEntry.findMany({
    where: { scheduleId: id },
    include: { nurse: true },
    orderBy: [
      { nurseId: "asc" },
      { workDate: "asc" },
    ],
  });

  return NextResponse.json(entries);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { entries, nurseIds } = body;

    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: "Required field: entries (array)" },
        { status: 400 }
      );
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: id },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    if (schedule.status === "CONFIRMED") {
      return NextResponse.json(
        { error: "확정된 근무표는 수정할 수 없습니다. 확정 취소 후 수정해주세요." },
        { status: 400 }
      );
    }

    const currentUser = await requireCurrentUser();
    const userId = currentUser.id;

    // Build a set of (nurseId, workDate) from incoming entries
    const incomingKeys = new Set<string>();
    const affectedNurseIds = new Set<string>();

    for (const entry of entries) {
      if (!entry.nurseId || !entry.day || !entry.shiftTypeCode) continue;
      const workDate = new Date(schedule.year, schedule.month - 1, entry.day);
      incomingKeys.add(`${entry.nurseId}|${workDate.toISOString()}`);
      affectedNurseIds.add(entry.nurseId);
    }

    // Fetch all existing entries to detect deletions and changes
    const existingEntries = await prisma.scheduleEntry.findMany({
      where: { scheduleId: id },
    });

    // Find entries that exist in DB but not in incoming data (deleted/cleared)
    const entriesToDelete: string[] = [];
    for (const existing of existingEntries) {
      const key = `${existing.nurseId}|${existing.workDate.toISOString()}`;
      if (!incomingKeys.has(key)) {
        entriesToDelete.push(existing.id);
        affectedNurseIds.add(existing.nurseId);

        // Record change log for deletion
        await prisma.scheduleChangeLog.create({
          data: {
            scheduleId: id,
            nurseId: existing.nurseId,
            workDate: existing.workDate,
            previousShiftCode: existing.shiftTypeCode,
            newShiftCode: "",
            changedById: userId,
            versionBefore: schedule.version,
            versionAfter: schedule.version,
          },
        });
      }
    }

    // Delete removed entries
    if (entriesToDelete.length > 0) {
      await prisma.scheduleEntry.deleteMany({
        where: { id: { in: entriesToDelete } },
      });
    }

    // Build lookup of existing entries for change detection
    const existingMap = new Map<string, string>();
    for (const e of existingEntries) {
      existingMap.set(`${e.nurseId}|${e.workDate.toISOString()}`, e.shiftTypeCode);
    }

    // Upsert each incoming entry and record change logs
    for (const entry of entries) {
      const { nurseId, day, shiftTypeCode } = entry;

      if (!nurseId || !day || !shiftTypeCode) {
        continue;
      }

      const workDate = new Date(schedule.year, schedule.month - 1, day);
      const key = `${nurseId}|${workDate.toISOString()}`;
      const previousShiftCode = existingMap.get(key) || null;
      const isChanged = previousShiftCode !== shiftTypeCode;

      await prisma.scheduleEntry.upsert({
        where: {
          scheduleId_nurseId_workDate: {
            scheduleId: id,
            nurseId,
            workDate,
          },
        },
        update: {
          shiftTypeCode,
          isModified: true,
        },
        create: {
          scheduleId: id,
          nurseId,
          workDate,
          shiftTypeCode,
        },
      });

      // Record change log if value changed
      if (isChanged) {
        await prisma.scheduleChangeLog.create({
          data: {
            scheduleId: id,
            nurseId,
            workDate,
            previousShiftCode,
            newShiftCode: shiftTypeCode,
            changedById: userId,
            versionBefore: schedule.version,
            versionAfter: schedule.version,
          },
        });
      }
    }

    // Recalculate summaries for all affected nurses
    for (const nurseId of Array.from(affectedNurseIds)) {
      const nurseEntries = await prisma.scheduleEntry.findMany({
        where: {
          scheduleId: id,
          nurseId,
        },
      });

      // Count shift types
      let countD = 0;
      let countE = 0;
      let countN = 0;
      let countT = 0;
      let countX = 0;
      let countO = 0;

      for (const e of nurseEntries) {
        switch (e.shiftTypeCode) {
          case "D": countD++; break;
          case "E": countE++; break;
          case "N": countN++; break;
          case "T": countT++; break;
          case "X": countX++; break;
          case "O": countO++; break;
        }
      }

      const countXO = countX + countO;
      const totalWorkingDays = countD + countE + countN + countT;
      const totalOffDays = countX + countO;

      // Upsert into schedule_summaries
      await prisma.scheduleSummary.upsert({
        where: {
          scheduleId_nurseId: {
            scheduleId: id,
            nurseId,
          },
        },
        update: {
          countD,
          countE,
          countN,
          countT,
          countX,
          countO,
          countXO,
          totalWorkingDays,
          totalOffDays,
        },
        create: {
          scheduleId: id,
          nurseId,
          countD,
          countE,
          countN,
          countT,
          countX,
          countO,
          countXO,
          totalWorkingDays,
          totalOffDays,
        },
      });
    }

    // Clean up summaries for nurses removed from the schedule
    if (nurseIds && Array.isArray(nurseIds) && nurseIds.length > 0) {
      await prisma.scheduleSummary.deleteMany({
        where: {
          scheduleId: id,
          nurseId: { notIn: nurseIds },
        },
      });
    }

    // Return updated entries
    const updatedEntries = await prisma.scheduleEntry.findMany({
      where: { scheduleId: id },
      include: { nurse: true },
      orderBy: [
        { nurseId: "asc" },
        { workDate: "asc" },
      ],
    });

    return NextResponse.json(updatedEntries);
  } catch (error) {
    console.error("Failed to save entries:", error);
    return NextResponse.json(
      { error: "Failed to save entries" },
      { status: 500 }
    );
  }
}
