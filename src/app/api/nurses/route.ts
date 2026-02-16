import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wardId = searchParams.get("wardId");
  const status = searchParams.get("status") || "ACTIVE";

  const nurses = await prisma.nurse.findMany({
    where: {
      ...(wardId ? { wardId } : {}),
      employmentStatus: status,
    },
    include: {
      ward: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  return NextResponse.json(nurses);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeNumber, name, position, positionRank, wardId, hireDate, sortOrder } = body;

    if (!employeeNumber || !name || !position || positionRank === undefined || !wardId) {
      return NextResponse.json(
        { error: "Required fields: employeeNumber, name, position, positionRank, wardId" },
        { status: 400 }
      );
    }

    const nurse = await prisma.nurse.create({
      data: {
        employeeNumber,
        name,
        position,
        positionRank,
        wardId,
        hireDate: hireDate ? new Date(hireDate) : null,
        sortOrder: sortOrder ?? 0,
      },
      include: {
        ward: true,
      },
    });

    return NextResponse.json(nurse, { status: 201 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Employee number already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create nurse" },
      { status: 500 }
    );
  }
}
