import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const changeLogs = await prisma.scheduleChangeLog.findMany({
    where: { scheduleId: params.id },
    include: {
      nurse: {
        select: { id: true, name: true },
      },
      changedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { changedAt: "desc" },
  });

  return NextResponse.json(changeLogs);
}
