import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const shiftTypes = await prisma.shiftType.findMany({
    orderBy: { displayOrder: "asc" },
  });

  return NextResponse.json(shiftTypes);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, description, colorCode, isWorkingDay, displayOrder } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Required fields: code, name" },
        { status: 400 }
      );
    }

    const shiftType = await prisma.shiftType.create({
      data: {
        code,
        name,
        description: description || null,
        colorCode: colorCode || null,
        isWorkingDay: isWorkingDay ?? true,
        displayOrder: displayOrder ?? 0,
      },
    });

    return NextResponse.json(shiftType, { status: 201 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "이미 존재하는 근무유형 코드입니다." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "근무유형 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
