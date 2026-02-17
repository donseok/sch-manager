import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
          const wards = await prisma.ward.findMany({
                  orderBy: { wardCode: "asc" },
          });

      return NextResponse.json(wards);
    } catch (error) {
          console.error("Failed to fetch wards:", error);
          return NextResponse.json(
            { error: "병동 정보를 불러오는데 실패했습니다." },
            { status: 500 }
                );
    }
}

export async function POST(request: NextRequest) {
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
