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
    const { action, comment } = body;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session.user as any).id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRole = (session.user as any).role;

    if (!action || !["SUBMIT", "APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be SUBMIT, APPROVE, or REJECT" },
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

    // SUBMIT: Only HEAD_NURSE can submit, DRAFT -> PENDING_MANAGER
    if (action === "SUBMIT") {
      if (userRole !== "HEAD_NURSE") {
        return NextResponse.json(
          { error: "Only HEAD_NURSE can submit schedules" },
          { status: 403 }
        );
      }

      if (schedule.status !== "DRAFT") {
        return NextResponse.json(
          { error: "Only DRAFT schedules can be submitted" },
          { status: 400 }
        );
      }

      await prisma.$transaction([
        prisma.schedule.update({
          where: { id: params.id },
          data: { status: "PENDING_MANAGER" },
        }),
        prisma.scheduleApproval.create({
          data: {
            scheduleId: params.id,
            approvalStep: 1,
            approvalRole: "HEAD_NURSE",
            approverId: userId,
            action: "SUBMIT",
            comment: comment || null,
          },
        }),
      ]);

      return NextResponse.json({ message: "Schedule submitted for manager approval", status: "PENDING_MANAGER" });
    }

    // APPROVE
    if (action === "APPROVE") {
      // PENDING_MANAGER -> PENDING_DIRECTOR (NURSING_MANAGER approves)
      if (schedule.status === "PENDING_MANAGER") {
        if (userRole !== "NURSING_MANAGER") {
          return NextResponse.json(
            { error: "Only NURSING_MANAGER can approve at this stage" },
            { status: 403 }
          );
        }

        await prisma.$transaction([
          prisma.schedule.update({
            where: { id: params.id },
            data: { status: "PENDING_DIRECTOR" },
          }),
          prisma.scheduleApproval.create({
            data: {
              scheduleId: params.id,
              approvalStep: 2,
              approvalRole: "NURSING_MANAGER",
              approverId: userId,
              action: "APPROVE",
              comment: comment || null,
            },
          }),
        ]);

        return NextResponse.json({ message: "Schedule approved by manager, pending director approval", status: "PENDING_DIRECTOR" });
      }

      // PENDING_DIRECTOR -> CONFIRMED (NURSING_DIRECTOR approves)
      if (schedule.status === "PENDING_DIRECTOR") {
        if (userRole !== "NURSING_DIRECTOR") {
          return NextResponse.json(
            { error: "Only NURSING_DIRECTOR can approve at this stage" },
            { status: 403 }
          );
        }

        await prisma.$transaction([
          prisma.schedule.update({
            where: { id: params.id },
            data: {
              status: "CONFIRMED",
              confirmedAt: new Date(),
              confirmedById: userId,
            },
          }),
          prisma.scheduleApproval.create({
            data: {
              scheduleId: params.id,
              approvalStep: 3,
              approvalRole: "NURSING_DIRECTOR",
              approverId: userId,
              action: "APPROVE",
              comment: comment || null,
            },
          }),
        ]);

        return NextResponse.json({ message: "Schedule confirmed by director", status: "CONFIRMED" });
      }

      return NextResponse.json(
        { error: `Cannot approve schedule with status: ${schedule.status}` },
        { status: 400 }
      );
    }

    // REJECT: Return to DRAFT status
    if (action === "REJECT") {
      if (!["PENDING_MANAGER", "PENDING_DIRECTOR"].includes(schedule.status)) {
        return NextResponse.json(
          { error: "Can only reject schedules that are pending approval" },
          { status: 400 }
        );
      }

      const approvalStep = schedule.status === "PENDING_MANAGER" ? 2 : 3;
      const approvalRole = schedule.status === "PENDING_MANAGER" ? "NURSING_MANAGER" : "NURSING_DIRECTOR";

      await prisma.$transaction([
        prisma.schedule.update({
          where: { id: params.id },
          data: { status: "DRAFT" },
        }),
        prisma.scheduleApproval.create({
          data: {
            scheduleId: params.id,
            approvalStep,
            approvalRole,
            approverId: userId,
            action: "REJECT",
            comment: comment || null,
          },
        }),
      ]);

      return NextResponse.json({ message: "Schedule rejected and returned to draft", status: "DRAFT" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
