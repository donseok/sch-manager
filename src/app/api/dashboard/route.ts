export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [
    totalNurses,
    currentMonthSchedules,
    recentSchedules,
    recentChanges,
  ] = await Promise.all([
    // Total active nurses
    prisma.nurse.count({
      where: { employmentStatus: "ACTIVE" },
    }),

    // Current month schedules count
    prisma.schedule.count({
      where: {
        year: currentYear,
        month: currentMonth,
      },
    }),

    // Recent 5 schedules with ward name and status
    prisma.schedule.findMany({
      take: 5,
      include: {
        ward: {
          select: { wardName: true },
        },
      },
      orderBy: [
        { year: "desc" },
        { month: "desc" },
        { createdAt: "desc" },
      ],
    }),

    // Recent 10 schedule change logs
    prisma.scheduleChangeLog.findMany({
      take: 10,
      include: {
        nurse: {
          select: { name: true },
        },
        changedBy: {
          select: { name: true },
        },
        schedule: {
          select: {
            year: true,
            month: true,
            ward: {
              select: { wardName: true },
            },
          },
        },
      },
      orderBy: { changedAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    totalNurses,
    currentMonthSchedules,
    recentSchedules,
    recentChanges,
  });
}
