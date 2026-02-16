import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const wardId = searchParams.get("wardId");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const schedules = await prisma.schedule.findMany({
    where: {
      ...(wardId ? { wardId } : {}),
      ...(year ? { year: parseInt(year) } : {}),
      ...(month ? { month: parseInt(month) } : {}),
    },
    include: {
      ward: true,
      createdBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { year: "desc" },
      { month: "desc" },
    ],
  });

  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { wardId, year, month } = body;

    if (!wardId || !year || !month) {
      return NextResponse.json(
        { error: "Required fields: wardId, year, month" },
        { status: 400 }
      );
    }

    // Check for existing schedule with same ward/year/month
    const existing = await prisma.schedule.findFirst({
      where: { wardId, year, month },
      orderBy: { version: "desc" },
    });

    const version = existing ? existing.version + 1 : 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session.user as any).id;

    const schedule = await prisma.schedule.create({
      data: {
        wardId,
        year,
        month,
        version,
        status: "DRAFT",
        createdById: userId,
      },
      include: {
        ward: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}
