import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { wardCode, wardName, description, isActive } = body;

        const ward = await prisma.ward.update({
            where: { id },
            data: {
                ...(wardCode !== undefined ? { wardCode } : {}),
                ...(wardName !== undefined ? { wardName } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(isActive !== undefined ? { isActive } : {}),
            },
        });

        return NextResponse.json(ward);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code === "P2025") {
            return NextResponse.json(
                { error: "병동을 찾을 수 없습니다." },
                { status: 404 }
            );
        }
        if (error.code === "P2002") {
            return NextResponse.json(
                { error: "이미 존재하는 병동 코드입니다." },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: "병동 수정에 실패했습니다." },
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
        const ward = await prisma.ward.update({
            where: { id },
            data: { isActive: false },
        });

        return NextResponse.json(ward);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code === "P2025") {
            return NextResponse.json(
                { error: "병동을 찾을 수 없습니다." },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: "병동 삭제에 실패했습니다." },
            { status: 500 }
        );
    }
}
