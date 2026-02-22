import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, description, colorCode, isWorkingDay, displayOrder, isActive } = body;

        const shiftType = await prisma.shiftType.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(colorCode !== undefined ? { colorCode } : {}),
                ...(isWorkingDay !== undefined ? { isWorkingDay } : {}),
                ...(displayOrder !== undefined ? { displayOrder } : {}),
                ...(isActive !== undefined ? { isActive } : {}),
            },
        });

        return NextResponse.json(shiftType);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code === "P2025") {
            return NextResponse.json(
                { error: "근무유형을 찾을 수 없습니다." },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: "근무유형 수정에 실패했습니다." },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const shiftType = await prisma.shiftType.update({
            where: { id },
            data: { isActive: false },
        });

        return NextResponse.json(shiftType);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code === "P2025") {
            return NextResponse.json(
                { error: "근무유형을 찾을 수 없습니다." },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: "근무유형 삭제에 실패했습니다." },
            { status: 500 }
        );
    }
}
