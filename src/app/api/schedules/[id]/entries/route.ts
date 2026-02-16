import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.scheduleEntry.findMany({
    where: { scheduleId: params.id },
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
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { entries } = body;

    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: "Required field: entries (array)" },
        { status: 400 }
      );
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Upsert each entry
    const affectedNurseIds = new Set<string>();

    for (const entry of entries) {
      const { nurseId, day, shiftTypeCode } = entry;

      if (!nurseId || !day || !shiftTypeCode) {
        continue;
      }

      // Compute workDate from schedule's year/month/day
      const workDate = new Date(schedule.year, schedule.month - 1, day);

      await prisma.scheduleEntry.upsert({
        where: {
          scheduleId_nurseId_workDate: {
            scheduleId: params.id,
            nurseId,
            workDate,
          },
        },
        update: {
          shiftTypeCode,
          isModified: true,
        },
        create: {
          scheduleId: params.id,
          nurseId,
          workDate,
          shiftTypeCode,
        },
      });

      affectedNurseIds.add(nurseId);
    }

    // Recalculate summaries for all affected nurses
    for (const nurseId of Array.from(affectedNurseIds)) {
      const nurseEntries = await prisma.scheduleEntry.findMany({
        where: {
          scheduleId: params.id,
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
            scheduleId: params.id,
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
          scheduleId: params.id,
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

    // Return updated entries
    const updatedEntries = await prisma.scheduleEntry.findMany({
      where: { scheduleId: params.id },
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
