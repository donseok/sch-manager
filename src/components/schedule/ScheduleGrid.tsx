"use client";

import { memo, useCallback, useMemo } from "react";
import { useScheduleStore } from "@/store/schedule";
import {
  getDaysInMonth,
  getDayOfWeek,
  getDayOfWeekIndex,
  POSITION_LABELS,
} from "@/lib/utils";
import ShiftCell from "@/components/schedule/ShiftCell";

interface ScheduleGridProps {
  year: number;
  month: number;
  editable: boolean;
}

const SUMMARY_KEYS = ["D", "E", "N", "T", "X", "O", "XO"] as const;

const SUMMARY_LABELS: Record<string, string> = {
  D: "D",
  E: "E",
  N: "N",
  T: "T",
  X: "X",
  O: "O",
  XO: "X+O",
};

function ScheduleGridInner({ year, month, editable }: ScheduleGridProps) {
  const gridData = useScheduleStore((state) => state.gridData);
  const updateCell = useScheduleStore((state) => state.updateCell);

  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  );

  const dayInfo = useMemo(
    () =>
      days.map((day) => ({
        day,
        label: getDayOfWeek(year, month, day),
        index: getDayOfWeekIndex(year, month, day),
      })),
    [days, year, month]
  );

  const handleCellSelect = useCallback(
    (nurseId: string, day: number, shiftCode: string) => {
      updateCell(nurseId, day, shiftCode);
    },
    [updateCell]
  );

  // Background colors for weekend columns
  const getDayBgClass = useCallback((dayIndex: number) => {
    if (dayIndex === 0) return "bg-red-50"; // Sunday
    if (dayIndex === 6) return "bg-blue-50"; // Saturday
    return "";
  }, []);

  // Day label text color for weekends
  const getDayTextClass = useCallback((dayIndex: number) => {
    if (dayIndex === 0) return "text-red-500";
    if (dayIndex === 6) return "text-blue-500";
    return "text-gray-600";
  }, []);

  if (gridData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-sm">배정된 간호사가 없습니다.</p>
        <p className="mt-1 text-xs">
          해당 병동에 간호사를 먼저 배정해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="border-collapse text-xs">
        <thead>
          {/* Row 1: Column headers */}
          <tr className="bg-gray-100">
            <th className="sticky left-0 z-20 min-w-[80px] border border-gray-200 bg-gray-100 px-2 py-2 text-center font-semibold text-gray-700">
              사원번호
            </th>
            <th className="sticky left-[80px] z-20 min-w-[72px] border border-gray-200 bg-gray-100 px-2 py-2 text-center font-semibold text-gray-700">
              사원명
            </th>
            <th className="sticky left-[152px] z-20 min-w-[72px] border border-gray-200 bg-gray-100 px-2 py-2 text-center font-semibold text-gray-700">
              직위
            </th>
            {dayInfo.map(({ day, index }) => (
              <th
                key={`h1-${day}`}
                className={`min-w-[40px] border border-gray-200 px-1 py-2 text-center font-semibold ${getDayBgClass(
                  index
                )} ${getDayTextClass(index)}`}
              >
                {day}
              </th>
            ))}
            {/* Summary headers */}
            {SUMMARY_KEYS.map((key) => (
              <th
                key={`sum-${key}`}
                className="min-w-[36px] border border-gray-200 bg-gray-200 px-1 py-2 text-center font-semibold text-gray-700"
              >
                {SUMMARY_LABELS[key]}
              </th>
            ))}
          </tr>
          {/* Row 2: Day of week */}
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-20 border border-gray-200 bg-gray-50 px-2 py-1" />
            <th className="sticky left-[80px] z-20 border border-gray-200 bg-gray-50 px-2 py-1" />
            <th className="sticky left-[152px] z-20 border border-gray-200 bg-gray-50 px-2 py-1" />
            {dayInfo.map(({ day, label, index }) => (
              <th
                key={`h2-${day}`}
                className={`border border-gray-200 px-1 py-1 text-center text-[10px] font-medium ${getDayBgClass(
                  index
                )} ${getDayTextClass(index)}`}
              >
                {label}
              </th>
            ))}
            {/* Empty summary header row 2 */}
            {SUMMARY_KEYS.map((key) => (
              <th
                key={`sum2-${key}`}
                className="border border-gray-200 bg-gray-200 px-1 py-1"
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {gridData.map((row) => (
            <NurseRow
              key={row.nurseId}
              row={row}
              dayInfo={dayInfo}
              editable={editable}
              onCellSelect={handleCellSelect}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Memoized nurse row to prevent unnecessary re-renders
interface NurseRowProps {
  row: {
    nurseId: string;
    nurseName: string;
    employeeNumber: string;
    position: string;
    entries: Record<number, string>;
    summary: {
      D: number;
      E: number;
      N: number;
      T: number;
      X: number;
      O: number;
      XO: number;
    };
  };
  dayInfo: { day: number; label: string; index: number }[];
  editable: boolean;
  onCellSelect: (nurseId: string, day: number, shiftCode: string) => void;
}

const NurseRow = memo(function NurseRow({
  row,
  dayInfo,
  editable,
  onCellSelect,
}: NurseRowProps) {
  return (
    <tr className="hover:bg-gray-50/50">
      {/* Sticky: employee number */}
      <td className="sticky left-0 z-10 border border-gray-200 bg-white px-2 py-1 text-center font-mono text-[11px] text-gray-600 whitespace-nowrap">
        {row.employeeNumber}
      </td>
      {/* Sticky: name */}
      <td className="sticky left-[80px] z-10 border border-gray-200 bg-white px-2 py-1 text-center font-medium text-gray-900 whitespace-nowrap">
        {row.nurseName}
      </td>
      {/* Sticky: position */}
      <td className="sticky left-[152px] z-10 border border-gray-200 bg-white px-2 py-1 text-center text-gray-600 whitespace-nowrap">
        {POSITION_LABELS[row.position] || row.position}
      </td>
      {/* Day cells */}
      {dayInfo.map(({ day }) => (
        <ShiftCell
          key={`${row.nurseId}-${day}`}
          nurseId={row.nurseId}
          day={day}
          value={row.entries[day] || ""}
          editable={editable}
          onSelect={onCellSelect}
        />
      ))}
      {/* Summary cells */}
      {SUMMARY_KEYS.map((key) => (
        <td
          key={`${row.nurseId}-sum-${key}`}
          className="border border-gray-200 bg-gray-50 px-1 py-1 text-center font-semibold text-gray-700"
        >
          {row.summary[key]}
        </td>
      ))}
    </tr>
  );
});

const ScheduleGrid = memo(ScheduleGridInner);
ScheduleGrid.displayName = "ScheduleGrid";

export default ScheduleGrid;
