import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
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

    // Use the first available user as default creator
    const defaultUser = await prisma.user.findFirst();
    if (!defaultUser) {
      return NextResponse.json(
        { error: "No user found in system" },
        { status: 500 }
      );
    }

    const schedule = await prisma.schedule.create({
      data: {
        wardId,
        year,
        month,
        version,
        status: "DRAFT",
        createdById: defaultUser.id,
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
