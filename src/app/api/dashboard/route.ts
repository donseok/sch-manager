import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [totalNurses, currentMonthSchedules, pendingApprovals, recentSchedules] =
    await Promise.all([
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

      // Pending approvals count
      prisma.schedule.count({
        where: {
          status: {
            in: ["PENDING_MANAGER", "PENDING_DIRECTOR"],
          },
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
    ]);

  return NextResponse.json({
    totalNurses,
    currentMonthSchedules,
    pendingApprovals,
    recentSchedules,
  });
}
