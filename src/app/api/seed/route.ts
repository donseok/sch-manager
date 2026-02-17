import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
    try {
          // Check if data already exists
      const existingWard = await prisma.ward.findFirst();
          if (existingWard) {
                  return NextResponse.json({ message: "Database already seeded" });
          }

      // Create ward
      const ward = await prisma.ward.create({
              data: {
                        wardCode: "42",
                        wardName: "42병동",
                        description: "42병동",
                        isActive: true,
              },
      });

      // Create default user
      const user = await prisma.user.create({
              data: {
                        loginId: "admin",
                        passwordHash: "admin",
                        name: "관리자",
                        role: "ADMIN",
                        wardId: ward.id,
              },
      });

      // Create shift types
      const shiftTypes = [
        { code: "D", name: "데이", colorCode: "#3B82F6", isWorkingDay: true, displayOrder: 1 },
        { code: "E", name: "이브닝", colorCode: "#F59E0B", isWorkingDay: true, displayOrder: 2 },
        { code: "N", name: "나이트", colorCode: "#8B5CF6", isWorkingDay: true, displayOrder: 3 },
        { code: "O", name: "OFF", colorCode: "#6B7280", isWorkingDay: false, displayOrder: 4 },
        { code: "X", name: "휴가", colorCode: "#10B981", isWorkingDay: false, displayOrder: 5 },
            ];

      for (const st of shiftTypes) {
              await prisma.shiftType.create({ data: st });
      }

      // Create sample nurses
      const nurses = [
        { employeeNumber: "N001", name: "김간호", position: "수간호사", positionRank: 1, sortOrder: 1 },
        { employeeNumber: "N002", name: "이간호", position: "주임간호사", positionRank: 2, sortOrder: 2 },
        { employeeNumber: "N003", name: "박간호", position: "간호사", positionRank: 3, sortOrder: 3 },
        { employeeNumber: "N004", name: "최간호", position: "간호사", positionRank: 3, sortOrder: 4 },
        { employeeNumber: "N005", name: "정간호", position: "간호사", positionRank: 3, sortOrder: 5 },
            ];

      for (const nurse of nurses) {
              await prisma.nurse.create({
                        data: {
                                    ...nurse,
                                    wardId: ward.id,
                        },
              });
      }

      return NextResponse.json({
              message: "Database seeded successfully",
              ward: ward.wardName,
              user: user.name,
              shiftTypes: shiftTypes.length,
              nurses: nurses.length,
      }, { status: 201 });
    } catch (error) {
          console.error("Seed error:", error);
          return NextResponse.json(
            { error: "Failed to seed database", details: String(error) },
            { status: 500 }
                );
    }
}
