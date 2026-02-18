import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Compute per-nurse statistics for a given schedule
export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const schedule = await prisma.schedule.findUnique({
            where: { id: params.id },
            include: {
                entries: {
                    include: {
                        nurse: {
                            select: { id: true, name: true, employeeNumber: true, position: true },
                        },
                    },
                },
                ward: { select: { wardName: true } },
            },
        });

        if (!schedule) {
            return NextResponse.json({ error: "근무표를 찾을 수 없습니다." }, { status: 404 });
        }

        const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();

        // Build entries map per nurse
        const nurseMap = new Map<
            string,
            {
                id: string;
                name: string;
                employeeNumber: string;
                position: string;
                entries: Record<number, string>;
            }
        >();

        for (const entry of schedule.entries) {
            const key = entry.nurse.id;
            if (!nurseMap.has(key)) {
                nurseMap.set(key, {
                    id: entry.nurse.id,
                    name: entry.nurse.name,
                    employeeNumber: entry.nurse.employeeNumber,
                    position: entry.nurse.position,
                    entries: {},
                });
            }
            const day = new Date(entry.workDate).getDate();
            nurseMap.get(key)!.entries[day] = entry.shiftTypeCode;
        }

        const WORKING = new Set(["D", "E", "N", "T"]);
        const O_EQUIV = new Set(["O", "M", "CS2", "C6", "B"]);

        const stats = Array.from(nurseMap.values()).map((nurse) => {
            let D = 0, E = 0, N = 0, T = 0, X = 0, O = 0;
            let weekendWork = 0;
            let maxConsecutive = 0;
            let currentConsecutive = 0;
            let totalHours = 0;

            for (let day = 1; day <= daysInMonth; day++) {
                const code = nurse.entries[day] || "";
                const dow = new Date(schedule.year, schedule.month - 1, day).getDay();
                const isWorking = WORKING.has(code);

                // Shift counts (M, CS2, C6, B count as O)
                if (O_EQUIV.has(code)) O++;
                else if (code === "D") D++;
                else if (code === "E") E++;
                else if (code === "N") N++;
                else if (code === "T") T++;
                else if (code === "X") X++;

                // Weekend work
                if (isWorking && (dow === 0 || dow === 6)) weekendWork++;

                // Consecutive
                if (isWorking) {
                    currentConsecutive++;
                    if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
                } else {
                    currentConsecutive = 0;
                }

                // Hours
                if (isWorking) totalHours += 8;
            }

            return {
                nurseId: nurse.id,
                nurseName: nurse.name,
                employeeNumber: nurse.employeeNumber,
                position: nurse.position,
                D,
                E,
                N,
                T,
                X,
                O,
                XO: X + O,
                weekendWork,
                maxConsecutive,
                totalHours,
            };
        });

        // Sort by employee number
        stats.sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));

        // Compute averages
        const count = stats.length || 1;
        const avgN = stats.reduce((s, r) => s + r.N, 0) / count;
        const avgWeekend = stats.reduce((s, r) => s + r.weekendWork, 0) / count;
        const avgHours = stats.reduce((s, r) => s + r.totalHours, 0) / count;

        return NextResponse.json({
            scheduleId: schedule.id,
            wardName: schedule.ward.wardName,
            year: schedule.year,
            month: schedule.month,
            stats,
            averages: {
                N: Math.round(avgN * 10) / 10,
                weekendWork: Math.round(avgWeekend * 10) / 10,
                totalHours: Math.round(avgHours * 10) / 10,
            },
        });
    } catch (error) {
        console.error("Failed to compute schedule stats:", error);
        return NextResponse.json({ error: "통계 계산에 실패했습니다." }, { status: 500 });
    }
}
