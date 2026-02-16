import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wards = await prisma.ward.findMany({
    where: { isActive: true },
    orderBy: { wardCode: "asc" },
  });

  return NextResponse.json(wards);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { wardCode, wardName, description } = body;

    if (!wardCode || !wardName) {
      return NextResponse.json(
        { error: "Required fields: wardCode, wardName" },
        { status: 400 }
      );
    }

    const ward = await prisma.ward.create({
      data: {
        wardCode,
        wardName,
        description: description || null,
      },
    });

    return NextResponse.json(ward, { status: 201 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Ward code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create ward" },
      { status: 500 }
    );
  }
}
