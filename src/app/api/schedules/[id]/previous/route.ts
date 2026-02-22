import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Find the current schedule to get ward, year, month
  const currentSchedule = await prisma.schedule.findUnique({
    where: { id },
    select: { wardId: true, year: true, month: true },
  });

  if (!currentSchedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  // Calculate the previous month
  let prevYear = currentSchedule.year;
  let prevMonth = currentSchedule.month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }

  // Find the previous month's schedule for the same ward (latest version)
  const previousSchedule = await prisma.schedule.findFirst({
    where: {
      wardId: currentSchedule.wardId,
      year: prevYear,
      month: prevMonth,
    },
    orderBy: { version: "desc" },
    include: {
      summaries: {
        include: {
          nurse: {
            select: {
              id: true,
              name: true,
              employeeNumber: true,
              position: true,
            },
          },
        },
      },
      ward: {
        select: { wardName: true },
      },
    },
  });

  if (!previousSchedule) {
    return NextResponse.json({ previous: null });
  }

  return NextResponse.json({
    previous: {
      id: previousSchedule.id,
      year: previousSchedule.year,
      month: previousSchedule.month,
      version: previousSchedule.version,
      status: previousSchedule.status,
      wardName: previousSchedule.ward.wardName,
      summaries: previousSchedule.summaries.map((s) => ({
        nurseId: s.nurseId,
        nurseName: s.nurse.name,
        employeeNumber: s.nurse.employeeNumber,
        position: s.nurse.position,
        countD: s.countD,
        countE: s.countE,
        countN: s.countN,
        countT: s.countT,
        countX: s.countX,
        countO: s.countO,
        countXO: s.countXO,
        totalWorkingDays: s.totalWorkingDays,
        totalOffDays: s.totalOffDays,
      })),
    },
  });
}
