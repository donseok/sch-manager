import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
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
            },
        });

        if (!schedule) {
            return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
        }

        const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
        const dayOfWeekKR = ["일", "월", "화", "수", "목", "금", "토"];

        // ─── Build nurse grid data ──────────────────────
        const nurseMap = new Map<
            string,
            {
                employeeNumber: string;
                name: string;
                position: string;
                entries: Record<number, string>;
            }
        >();

        for (const entry of schedule.entries) {
            if (!nurseMap.has(entry.nurseId)) {
                nurseMap.set(entry.nurseId, {
                    employeeNumber: entry.nurse.employeeNumber,
                    name: entry.nurse.name,
                    position: entry.nurse.position,
                    entries: {},
                });
            }
            const day = new Date(entry.workDate).getDate();
            nurseMap.get(entry.nurseId)!.entries[day] = entry.shiftTypeCode;
        }

        // Also include nurses from summaries without entries
        for (const summary of schedule.summaries) {
            if (!nurseMap.has(summary.nurseId)) {
                nurseMap.set(summary.nurseId, {
                    employeeNumber: summary.nurse.employeeNumber,
                    name: summary.nurse.name,
                    position: summary.nurse.position,
                    entries: {},
                });
            }
        }

        const POSITION_LABELS: Record<string, string> = {
            HN: "수간호사",
            CN: "책임간호사",
            AN: "주임간호사",
            RN: "일반간호사",
        };

        const SUMMARY_KEYS = ["D", "E", "N", "T", "X", "O", "XO"] as const;
        const nurses = Array.from(nurseMap.entries())
            .sort((a, b) => a[1].employeeNumber.localeCompare(b[1].employeeNumber))
            .map(([, data]) => {
                const counts: Record<string, number> = { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0, XO: 0 };
                Object.values(data.entries).forEach((code) => {
                    if (code in counts) counts[code]++;
                });
                counts.XO = counts.X + counts.O;
                return { ...data, counts };
            });

        // ─── Create workbook ────────────────────────────
        const wb = XLSX.utils.book_new();

        // Header row 1: 사원번호, 사원명, 직위, 1, 2, ..., daysInMonth, D, E, N, T, X, O, X+O
        const header1 = ["사원번호", "사원명", "직위"];
        for (let d = 1; d <= daysInMonth; d++) header1.push(String(d));
        for (const k of SUMMARY_KEYS) header1.push(k === "XO" ? "X+O" : k);

        // Header row 2: empty, empty, empty, 월, 화, ...
        const header2 = ["", "", ""];
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(schedule.year, schedule.month - 1, d).getDay();
            header2.push(dayOfWeekKR[dow]);
        }
        for (const _ of SUMMARY_KEYS) header2.push("");

        // Data rows
        const dataRows = nurses.map((nurse) => {
            const row: (string | number)[] = [
                nurse.employeeNumber,
                nurse.name,
                POSITION_LABELS[nurse.position] || nurse.position,
            ];
            for (let d = 1; d <= daysInMonth; d++) {
                row.push(nurse.entries[d] || "");
            }
            for (const k of SUMMARY_KEYS) {
                row.push(nurse.counts[k]);
            }
            return row;
        });

        // Daily summary rows
        const DAILY_TYPES = ["D", "E", "N", "T", "X"] as const;
        const dailySummaryRows: (string | number)[][] = [];

        // header
        const summaryHeader: (string | number)[] = ["", "근무집계", ""];
        for (let d = 1; d <= daysInMonth; d++) summaryHeader.push(d);
        summaryHeader.push("합계");
        for (let i = 1; i < SUMMARY_KEYS.length; i++) summaryHeader.push("");
        dailySummaryRows.push(summaryHeader);

        for (const type of DAILY_TYPES) {
            const row: (string | number)[] = ["", type, ""];
            let total = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                let count = 0;
                for (const nurse of nurses) {
                    if (nurse.entries[d] === type) count++;
                }
                row.push(count);
                total += count;
            }
            row.push(total);
            for (let i = 1; i < SUMMARY_KEYS.length; i++) row.push("");
            dailySummaryRows.push(row);
        }

        // T+X row
        const txRow: (string | number)[] = ["", "T + X", ""];
        let txTotal = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            let count = 0;
            for (const nurse of nurses) {
                if (nurse.entries[d] === "T" || nurse.entries[d] === "X") count++;
            }
            txRow.push(count);
            txTotal += count;
        }
        txRow.push(txTotal);
        for (let i = 1; i < SUMMARY_KEYS.length; i++) txRow.push("");
        dailySummaryRows.push(txRow);

        // 일별 총인원
        const totalRow: (string | number)[] = ["", "일별 총인원(명)", ""];
        let grandTotal = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            let count = 0;
            for (const nurse of nurses) {
                if (nurse.entries[d]) count++;
            }
            totalRow.push(count);
            grandTotal += count;
        }
        totalRow.push(grandTotal);
        for (let i = 1; i < SUMMARY_KEYS.length; i++) totalRow.push("");
        dailySummaryRows.push(totalRow);

        // Assemble all rows
        const allRows = [header1, header2, ...dataRows, ...dailySummaryRows];
        const ws = XLSX.utils.aoa_to_sheet(allRows);

        // Set column widths
        const colWidths = [
            { wch: 12 }, // 사원번호
            { wch: 8 },  // 사원명
            { wch: 10 }, // 직위
        ];
        for (let d = 0; d < daysInMonth; d++) colWidths.push({ wch: 4 });
        for (const _ of SUMMARY_KEYS) colWidths.push({ wch: 5 });
        ws["!cols"] = colWidths;

        const sheetName = `${schedule.ward.wardName} ${schedule.year}년 ${schedule.month}월`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

        // Generate buffer
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        const filename = `근무표_${schedule.ward.wardCode}_${schedule.year}${String(schedule.month).padStart(2, "0")}.xlsx`;

        return new NextResponse(buf, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
            },
        });
    } catch (error) {
        console.error("Excel generation error:", error);
        return NextResponse.json(
            { error: "엑셀 파일 생성에 실패했습니다." },
            { status: 500 }
        );
    }
}
