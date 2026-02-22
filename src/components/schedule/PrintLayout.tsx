import { Ref } from "react";
import type { ScheduleGridData } from "@/types";
import {
  getDaysInMonth,
  getDayOfWeek,
  getDayOfWeekIndex,
  STATUS_LABELS,
  POSITION_LABELS,
} from "@/lib/utils";

interface PrintLayoutProps {
  year: number;
  month: number;
  wardName: string;
  status: string;
  gridData: ScheduleGridData[];
  ref?: Ref<HTMLDivElement>;
}

function PrintLayout({ year, month, wardName, status, gridData, ref }: PrintLayoutProps) {
    const daysInMonth = getDaysInMonth(year, month);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const now = new Date();
    const printDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return (
      <div ref={ref} className="print-layout hidden">
        <style>{`
          .print-layout table {
            border-collapse: collapse;
            width: 100%;
            font-size: 9px;
            line-height: 1.2;
          }
          .print-layout th,
          .print-layout td {
            border: 1px solid #333;
            padding: 1px 2px;
            text-align: center;
            white-space: nowrap;
          }
          .print-layout th {
            background-color: #f0f0f0;
            font-weight: 600;
          }
          .print-layout .weekend-col {
            background-color: #f5f5f5;
          }
          .print-layout .sunday-col {
            background-color: #fef2f2;
          }
          .print-layout .title {
            font-size: 16px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 4px;
          }
          .print-layout .subtitle {
            font-size: 10px;
            text-align: center;
            margin-bottom: 8px;
            color: #555;
            display: flex;
            justify-content: space-between;
          }
          .print-layout .approval-line {
            margin-top: 16px;
            font-size: 10px;
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #999;
            padding-top: 8px;
          }
          .print-layout .name-col {
            text-align: left;
            padding-left: 4px;
          }
          .print-layout .summary-col {
            font-weight: 600;
          }
          .print-layout .daily-summary-header {
            background-color: #e8f5e9;
            font-weight: 700;
          }
          .print-layout .daily-summary-row td {
            background-color: #f1f8f1;
          }
          .print-layout .daily-summary-total {
            background-color: #c8e6c9;
            font-weight: 700;
          }
        `}</style>

        {/* Title */}
        <div className="title">
          {year}년 {month}월 {wardName} 근무확정표
        </div>

        {/* Subtitle */}
        <div className="subtitle">
          <span>상태: {STATUS_LABELS[status] || status}</span>
          <span>출력일시: {printDateTime}</span>
        </div>

        {/* Schedule Table */}
        <table>
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: "24px" }}>#</th>
              <th rowSpan={2} style={{ width: "56px" }}>사원번호</th>
              <th rowSpan={2} style={{ width: "48px" }}>사원명</th>
              <th rowSpan={2} style={{ width: "40px" }}>직위</th>
              {days.map((day) => {
                const dowIndex = getDayOfWeekIndex(year, month, day);
                const isSunday = dowIndex === 0;
                const isSaturday = dowIndex === 6;
                return (
                  <th
                    key={`day-header-${day}`}
                    className={
                      isSunday
                        ? "sunday-col"
                        : isSaturday
                          ? "weekend-col"
                          : ""
                    }
                  >
                    {day}
                  </th>
                );
              })}
              <th rowSpan={2}>D</th>
              <th rowSpan={2}>E</th>
              <th rowSpan={2}>N</th>
              <th rowSpan={2}>T</th>
              <th rowSpan={2}>X</th>
              <th rowSpan={2}>O</th>
              <th rowSpan={2}>X+O</th>
            </tr>
            <tr>
              {days.map((day) => {
                const dow = getDayOfWeek(year, month, day);
                const dowIndex = getDayOfWeekIndex(year, month, day);
                const isSunday = dowIndex === 0;
                const isSaturday = dowIndex === 6;
                return (
                  <th
                    key={`dow-header-${day}`}
                    className={
                      isSunday
                        ? "sunday-col"
                        : isSaturday
                          ? "weekend-col"
                          : ""
                    }
                  >
                    {dow}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {gridData.map((row, index) => (
              <tr key={row.nurseId}>
                <td>{index + 1}</td>
                <td>{row.employeeNumber}</td>
                <td className="name-col">{row.nurseName}</td>
                <td>{POSITION_LABELS[row.position] || row.position}</td>
                {days.map((day) => {
                  const dowIndex = getDayOfWeekIndex(year, month, day);
                  const isSunday = dowIndex === 0;
                  const isSaturday = dowIndex === 6;
                  return (
                    <td
                      key={`cell-${row.nurseId}-${day}`}
                      className={
                        isSunday
                          ? "sunday-col"
                          : isSaturday
                            ? "weekend-col"
                            : ""
                      }
                    >
                      {row.entries[day] || ""}
                    </td>
                  );
                })}
                <td className="summary-col">{row.summary.D}</td>
                <td className="summary-col">{row.summary.E}</td>
                <td className="summary-col">{row.summary.N}</td>
                <td className="summary-col">{row.summary.T}</td>
                <td className="summary-col">{row.summary.X}</td>
                <td className="summary-col">{row.summary.O}</td>
                <td className="summary-col">{row.summary.XO}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {(() => {
              const shiftTypes = ["D", "E", "N", "T", "X"] as const;
              const counts: Record<string, Record<number, number>> = {};
              const totals: Record<string, number> = {};

              for (const type of shiftTypes) {
                counts[type] = {};
                totals[type] = 0;
                for (const day of days) {
                  counts[type][day] = 0;
                }
              }

              for (const row of gridData) {
                for (const day of days) {
                  const shift = row.entries[day];
                  if (shift && counts[shift] !== undefined) {
                    counts[shift][day]++;
                    totals[shift]++;
                  }
                }
              }

              const txCounts: Record<number, number> = {};
              let txTotal = 0;
              for (const day of days) {
                txCounts[day] = counts.T[day] + counts.X[day];
                txTotal += txCounts[day];
              }

              const dailyTotal: Record<number, number> = {};
              let grandTotal = 0;
              for (const day of days) {
                dailyTotal[day] = 0;
                for (const row of gridData) {
                  if (row.entries[day]) dailyTotal[day]++;
                }
                grandTotal += dailyTotal[day];
              }

              return (
                <>
                  {/* 근무집계 header */}
                  <tr>
                    <td colSpan={4} className="daily-summary-header">근무집계</td>
                    {days.map((day) => {
                      const dowIndex = getDayOfWeekIndex(year, month, day);
                      return (
                        <td
                          key={`dsm-h-${day}`}
                          className={`daily-summary-header ${dowIndex === 0 ? "sunday-col" : dowIndex === 6 ? "weekend-col" : ""}`}
                        >
                          {day}
                        </td>
                      );
                    })}
                    <td colSpan={7} className="daily-summary-header">합계</td>
                  </tr>
                  {/* D, E, N, T, X rows */}
                  {shiftTypes.map((type) => (
                    <tr key={`dsm-${type}`} className="daily-summary-row">
                      <td colSpan={4} style={{ fontWeight: 600 }}>{type}</td>
                      {days.map((day) => (
                        <td key={`dsm-${type}-${day}`}>{counts[type][day] || 0}</td>
                      ))}
                      <td colSpan={7} className="summary-col">{totals[type]}</td>
                    </tr>
                  ))}
                  {/* T + X row */}
                  <tr className="daily-summary-row">
                    <td colSpan={4} style={{ fontWeight: 600 }}>T + X</td>
                    {days.map((day) => (
                      <td key={`dsm-tx-${day}`}>{txCounts[day] || 0}</td>
                    ))}
                    <td colSpan={7} className="summary-col">{txTotal}</td>
                  </tr>
                  {/* 일별 총인원 row */}
                  <tr>
                    <td colSpan={4} className="daily-summary-total">일별 총인원(명)</td>
                    {days.map((day) => (
                      <td key={`dsm-total-${day}`} className="daily-summary-total">{dailyTotal[day]}</td>
                    ))}
                    <td colSpan={7} className="daily-summary-total">{grandTotal}</td>
                  </tr>
                </>
              );
            })()}
          </tfoot>
        </table>

        {/* Approval Line */}
        <div className="approval-line">
          <span>확정일시: _______________</span>
          <span>작성: 수간호사 _______________</span>
          <span>승인: 간호과장 _______________</span>
          <span>확인: 간호부장 _______________</span>
        </div>
      </div>
    );
}

export default PrintLayout;
