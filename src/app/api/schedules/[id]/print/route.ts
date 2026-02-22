import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const currentUser = await requireCurrentUser();

    const printLog = await prisma.schedulePrintLog.create({
      data: {
        scheduleId: params.id,
        printedById: currentUser.id,
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
