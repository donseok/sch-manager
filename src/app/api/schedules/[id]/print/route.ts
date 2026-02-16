import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { printFormat } = body;

    if (!printFormat || !["PDF", "EXCEL", "PRINT"].includes(printFormat)) {
      return NextResponse.json(
        { error: "Invalid printFormat. Must be PDF, EXCEL, or PRINT" },
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session.user as any).id;

    const printLog = await prisma.schedulePrintLog.create({
      data: {
        scheduleId: params.id,
        printedById: userId,
        printFormat,
      },
    });

    return NextResponse.json(printLog, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to record print log" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const printLogs = await prisma.schedulePrintLog.findMany({
    where: { scheduleId: params.id },
    include: {
      printedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { printedAt: "desc" },
  });

  return NextResponse.json(printLogs);
}
