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
