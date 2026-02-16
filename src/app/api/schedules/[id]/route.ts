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

  const schedule = await prisma.schedule.findUnique({
    where: { id: params.id },
    include: {
      entries: {
        include: { nurse: true },
        orderBy: [
          { nurseId: "asc" },
          { workDate: "asc" },
        ],
      },
      summaries: {
        include: { nurse: true },
      },
      approvals: {
        include: {
          approver: {
            select: { id: true, name: true },
          },
        },
        orderBy: { actedAt: "asc" },
      },
      ward: true,
      createdBy: {
        select: { id: true, name: true },
      },
      confirmedBy: {
        select: { id: true, name: true },
      },
    },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  return NextResponse.json(schedule);
}
