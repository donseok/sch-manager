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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { action } = body;

    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, wardId: true, year: true, month: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: "근무표를 찾을 수 없습니다." }, { status: 404 });
    }

    const defaultUser = await prisma.user.findFirst();
    const userId = defaultUser?.id || "system";

    if (action === "confirm") {
      if (schedule.status === "CONFIRMED") {
        return NextResponse.json({ error: "이미 확정된 근무표입니다." }, { status: 400 });
      }

      // Check if another confirmed schedule already exists for the same ward/year/month
      const existingConfirmed = await prisma.schedule.findFirst({
        where: {
          wardId: schedule.wardId,
          year: schedule.year,
          month: schedule.month,
          status: "CONFIRMED",
          id: { not: params.id },
        },
        select: { version: true },
      });

      if (existingConfirmed) {
        return NextResponse.json(
          { error: `${schedule.year}년 ${schedule.month}월에 이미 확정된 근무표(v${existingConfirmed.version})가 있습니다. 기존 확정을 취소 후 다시 시도해주세요.` },
          { status: 400 }
        );
      }

      const updated = await prisma.schedule.update({
        where: { id: params.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          confirmedById: userId,
        },
        include: {
          entries: { include: { nurse: true }, orderBy: [{ nurseId: "asc" }, { workDate: "asc" }] },
          summaries: { include: { nurse: true } },
          ward: true,
          createdBy: { select: { id: true, name: true } },
          confirmedBy: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(updated);
    }

    if (action === "unconfirm") {
      if (schedule.status !== "CONFIRMED") {
        return NextResponse.json({ error: "확정 상태가 아닌 근무표입니다." }, { status: 400 });
      }

      const updated = await prisma.schedule.update({
        where: { id: params.id },
        data: {
          status: "DRAFT",
          confirmedAt: null,
          confirmedById: null,
        },
        include: {
          entries: { include: { nurse: true }, orderBy: [{ nurseId: "asc" }, { workDate: "asc" }] },
          summaries: { include: { nurse: true } },
          ward: true,
          createdBy: { select: { id: true, name: true } },
          confirmedBy: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  } catch (error) {
    console.error("Failed to update schedule:", error);
    return NextResponse.json({ error: "근무표 상태 변경에 실패했습니다." }, { status: 500 });
  }
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
