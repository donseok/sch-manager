import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const nurse = await prisma.nurse.findUnique({
    where: { id },
    include: { ward: true },
  });

  if (!nurse) {
    return NextResponse.json({ error: "Nurse not found" }, { status: 404 });
  }

  return NextResponse.json(nurse);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const nurse = await prisma.nurse.findUnique({
      where: { id },
    });

    if (!nurse) {
      return NextResponse.json({ error: "Nurse not found" }, { status: 404 });
    }

    const updated = await prisma.nurse.update({
      where: { id },
      data: {
        ...(body.employeeNumber !== undefined && { employeeNumber: body.employeeNumber }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.position !== undefined && { position: body.position }),
        ...(body.positionRank !== undefined && { positionRank: body.positionRank }),
        ...(body.wardId !== undefined && { wardId: body.wardId }),
        ...(body.hireDate !== undefined && { hireDate: body.hireDate ? new Date(body.hireDate) : null }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.employmentStatus !== undefined && { employmentStatus: body.employmentStatus }),
      },
      include: { ward: true },
    });

    return NextResponse.json(updated);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Employee number already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update nurse" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const nurse = await prisma.nurse.findUnique({
    where: { id },
  });

  if (!nurse) {
    return NextResponse.json({ error: "Nurse not found" }, { status: 404 });
  }

  const updated = await prisma.nurse.update({
    where: { id },
    data: { employmentStatus: "RESIGNED" },
  });

  return NextResponse.json(updated);
}
