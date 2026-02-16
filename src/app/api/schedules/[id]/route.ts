import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: params.id },
    include: {
      entries: {
        include: { nurse: true },
        orderBy: [
          { nurseId: "asc" },
          { workDate: "asc" },
        ],
      },
      summaries: {
        include: { nurse: true },
      },
      ward: true,
      createdBy: {
        select: { id: true, name: true },
      },
      confirmedBy: {
        select: { id: true, name: true },
      },
    },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  return NextResponse.json(schedule);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });

  if (!schedule) {
    return NextResponse.json({ error: "근무표를 찾을 수 없습니다." }, { status: 404 });
  }

  if (schedule.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "확정된 근무표는 삭제할 수 없습니다." },
      { status: 400 }
    );
  }

  await prisma.schedule.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ message: "근무표가 삭제되었습니다." });
}
