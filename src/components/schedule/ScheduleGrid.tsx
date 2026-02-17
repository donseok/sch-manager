"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScheduleStore } from "@/store/schedule";
import {
  getDaysInMonth,
  getDayOfWeek,
  getDayOfWeekIndex,
  POSITION_LABELS,
} from "@/lib/utils";
import ShiftCell from "@/components/schedule/ShiftCell";
import { X } from "lucide-react";

interface ScheduleGridProps {
  year: number;
  month: number;
  editable: boolean;
  onRemoveNurse?: (nurseId: string, nurseName: string) => void;
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

const DAILY_SHIFT_TYPES = ["D", "E", "N", "T", "X"] as const;

const VALID_SHIFT_CODES = new Set(["D", "E", "N", "O", "X", "T", "B", ""]);

// Extra derived stat columns shown after the main summary
const EXTRA_STAT_KEYS = ["WE", "CON", "HRS"] as const;
const EXTRA_STAT_LABELS: Record<string, string> = {
  WE: "주말",
  CON: "연속",
  HRS: "시간",
};

const WORKING_CODES = new Set(["D", "E", "N", "T", "B"]);
const HOURS_PER_SHIFT = 8;

function computeExtraStats(
  entries: Record<number, string>,
  dayInfo: { day: number; index: number }[],
  daysInMonth: number
): { WE: number; CON: number; HRS: number } {
  let weekendWork = 0;
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  let totalHours = 0;

  for (const { day, index } of dayInfo) {
    const code = entries[day];
    const isWorking = code ? WORKING_CODES.has(code) : false;

    // Weekend work: Sat(6) or Sun(0) with a working code
    if (isWorking && (index === 0 || index === 6)) {
      weekendWork++;
    }

    // Consecutive working days
    if (isWorking) {
      currentConsecutive++;
      if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
    } else {
      currentConsecutive = 0;
    }

    // Total hours
    if (isWorking) {
      totalHours += HOURS_PER_SHIFT;
    }
  }

  return { WE: weekendWork, CON: maxConsecutive, HRS: totalHours };
}

interface SelectionPoint {
  row: number;
  day: number;
}

interface SelectionBounds {
  minRow: number;
  maxRow: number;
  minDay: number;
  maxDay: number;
}

function ScheduleGridInner({ year, month, editable, onRemoveNurse }: ScheduleGridProps) {
  const gridData = useScheduleStore((state) => state.gridData);
  const updateCell = useScheduleStore((state) => state.updateCell);
  const updateCells = useScheduleStore((state) => state.updateCells);

  const tableRef = useRef<HTMLTableElement>(null);

  // Selection state
  const [selectionAnchor, setSelectionAnchor] = useState<SelectionPoint | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<SelectionPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  // Compute selection bounds from anchor and end
  const selectionBounds: SelectionBounds | null = useMemo(() => {
    if (!selectionAnchor || !selectionEnd) return null;
    return {
      minRow: Math.min(selectionAnchor.row, selectionEnd.row),
      maxRow: Math.max(selectionAnchor.row, selectionEnd.row),
      minDay: Math.min(selectionAnchor.day, selectionEnd.day),
      maxDay: Math.max(selectionAnchor.day, selectionEnd.day),
    };
  }, [selectionAnchor, selectionEnd]);

  // Extract row/day from a target element's data attributes
  const getCellCoords = useCallback((target: HTMLElement): SelectionPoint | null => {
    const td = target.closest("td[data-row][data-day]") as HTMLElement | null;
    if (!td) return null;
    const row = parseInt(td.dataset.row!, 10);
    const day = parseInt(td.dataset.day!, 10);
    if (isNaN(row) || isNaN(day)) return null;
    return { row, day };
  }, []);

  // Mouse down on table: start selection
  const handleTableMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editable) return;
      // Only left mouse button
      if (e.button !== 0) return;

      const coords = getCellCoords(e.target as HTMLElement);
      if (!coords) return;

      if (e.shiftKey && selectionAnchor) {
        // Extend selection
        setSelectionEnd(coords);
      } else {
        // Start new selection
        setSelectionAnchor(coords);
        setSelectionEnd(coords);
        setIsDragging(true);
      }
    },
    [editable, getCellCoords, selectionAnchor]
  );

  // Mouse over during drag: extend selection
  const handleTableMouseOver = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const coords = getCellCoords(e.target as HTMLElement);
      if (!coords) return;
      setSelectionEnd(coords);
    },
    [isDragging, getCellCoords]
  );

  // Global mouseup: end drag
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [isDragging]);

  // Clear selection when clicking outside the table
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSelectionAnchor(null);
        setSelectionEnd(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Keyboard handlers: Ctrl+C / Ctrl+V
  useEffect(() => {
    if (!editable) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if an input/textarea/select is focused
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+C: Copy
      if (isCtrl && e.key === "c" && selectionBounds) {
        e.preventDefault();
        const { minRow, maxRow, minDay, maxDay } = selectionBounds;
        const rows: string[] = [];
        for (let r = minRow; r <= maxRow; r++) {
          const rowData = gridData[r];
          if (!rowData) continue;
          const cols: string[] = [];
          for (let d = minDay; d <= maxDay; d++) {
            cols.push(rowData.entries[d] || "");
          }
          rows.push(cols.join("\t"));
        }
        const text = rows.join("\n");
        navigator.clipboard.writeText(text);
      }

      // Ctrl+V: Paste
      if (isCtrl && e.key === "v" && selectionAnchor) {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          if (!text) return;
          const pasteRows = text.split(/\r?\n/).filter((line) => line.length > 0 || text.split(/\r?\n/).length === 1);
          const updates: { nurseId: string; day: number; shiftCode: string }[] = [];

          for (let r = 0; r < pasteRows.length; r++) {
            const rowIndex = selectionAnchor.row + r;
            if (rowIndex >= gridData.length) break;
            const rowData = gridData[rowIndex];
            const values = pasteRows[r].split("\t");

            for (let c = 0; c < values.length; c++) {
              const day = selectionAnchor.day + c;
              if (day > daysInMonth) break;
              const val = values[c].trim().toUpperCase();
              if (VALID_SHIFT_CODES.has(val)) {
                updates.push({
                  nurseId: rowData.nurseId,
                  day,
                  shiftCode: val,
                });
              }
            }
          }

          if (updates.length > 0) {
            updateCells(updates);
            // Update selection to cover pasted area
            setSelectionEnd({
              row: Math.min(selectionAnchor.row + pasteRows.length - 1, gridData.length - 1),
              day: Math.min(
                selectionAnchor.day + Math.max(...pasteRows.map((r) => r.split("\t").length)) - 1,
                daysInMonth
              ),
            });
          }
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editable, selectionBounds, selectionAnchor, gridData, daysInMonth, updateCells]);

  // Daily shift summary calculation
  const dailySummary = useMemo(() => {
    const counts: Record<string, Record<number, number>> = {};
    const totals: Record<string, number> = {};

    for (const type of DAILY_SHIFT_TYPES) {
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

    // T+X per day
    const txCounts: Record<number, number> = {};
    let txTotal = 0;
    for (const day of days) {
      txCounts[day] = counts.T[day] + counts.X[day];
      txTotal += txCounts[day];
    }

    // Total personnel per day (all nurses with any entry)
    const dailyTotal: Record<number, number> = {};
    let grandTotal = 0;
    for (const day of days) {
      dailyTotal[day] = 0;
      for (const row of gridData) {
        const shift = row.entries[day];
        if (shift) {
          dailyTotal[day]++;
        }
      }
      grandTotal += dailyTotal[day];
    }

    return { counts, totals, txCounts, txTotal, dailyTotal, grandTotal };
  }, [gridData, days]);

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
    return "text-slate-600";
  }, []);

  if (gridData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <p className="text-base">배정된 간호사가 없습니다.</p>
        <p className="mt-1 text-sm">
          해당 병동에 간호사를 먼저 배정해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg dark:border-slate-700">
      <table
        ref={tableRef}
        className="border-collapse text-sm select-none"
        onMouseDown={handleTableMouseDown}
        onMouseOver={handleTableMouseOver}
      >
        <thead>
          {/* Row 1: Column headers */}
          <tr className="bg-slate-100 dark:bg-slate-800">
            <th className="sticky left-0 z-20 min-w-[80px] border border-slate-200 bg-slate-100 px-2 py-2 text-center font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              사원번호
            </th>
            <th className="sticky left-[80px] z-20 min-w-[72px] border border-slate-200 bg-slate-100 px-2 py-2 text-center font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              사원명
            </th>
            <th className="sticky left-[152px] z-20 min-w-[72px] border border-slate-200 bg-slate-100 px-2 py-2 text-center font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              직위
            </th>
            {dayInfo.map(({ day, index }) => (
              <th
                key={`h1-${day}`}
                className={`min-w-[40px] border border-slate-200 px-1 py-2 text-center font-semibold dark:border-slate-700 ${getDayBgClass(
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
                className="min-w-[36px] border border-slate-200 bg-slate-200 px-1 py-2 text-center font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300"
              >
                {SUMMARY_LABELS[key]}
              </th>
            ))}
            {/* Extra stat headers */}
            {EXTRA_STAT_KEYS.map((key) => (
              <th
                key={`ext-${key}`}
                className="min-w-[40px] border border-slate-200 bg-amber-100 px-1 py-2 text-center font-semibold text-amber-800 dark:border-slate-700 dark:bg-amber-900/40 dark:text-amber-200"
              >
                {EXTRA_STAT_LABELS[key]}
              </th>
            ))}
            {editable && onRemoveNurse && (
              <th className="min-w-[36px] border border-slate-200 bg-slate-200 px-1 py-2 text-center font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300">
                삭제
              </th>
            )}
          </tr>
          {/* Row 2: Day of week */}
          <tr className="bg-slate-50 dark:bg-slate-800/50">
            <th className="sticky left-0 z-20 border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/50" />
            <th className="sticky left-[80px] z-20 border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/50" />
            <th className="sticky left-[152px] z-20 border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/50" />
            {dayInfo.map(({ day, label, index }) => (
              <th
                key={`h2-${day}`}
                className={`border border-slate-200 px-1 py-1 text-center text-[11px] font-medium dark:border-slate-700 ${getDayBgClass(
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
                className="border border-slate-200 bg-slate-200 px-1 py-1 dark:border-slate-700 dark:bg-slate-700"
              />
            ))}
            {EXTRA_STAT_KEYS.map((key) => (
              <th
                key={`ext2-${key}`}
                className="border border-slate-200 bg-amber-100 px-1 py-1 dark:border-slate-700 dark:bg-amber-900/40"
              />
            ))}
            {editable && onRemoveNurse && (
              <th className="border border-slate-200 bg-slate-200 px-1 py-1 dark:border-slate-700 dark:bg-slate-700" />
            )}
          </tr>
        </thead>
        <tbody>
          {gridData.map((row, rowIndex) => (
            <NurseRow
              key={row.nurseId}
              row={row}
              rowIndex={rowIndex}
              dayInfo={dayInfo}
              daysInMonth={daysInMonth}
              editable={editable}
              selectionBounds={selectionBounds}
              onCellSelect={handleCellSelect}
              onRemove={editable && onRemoveNurse ? onRemoveNurse : undefined}
            />
          ))}
        </tbody>
        <tfoot>
          {/* 근무집계 header */}
          <tr className="bg-emerald-50 dark:bg-emerald-900/20">
            <td colSpan={3} className="sticky left-0 z-20 border border-slate-300 bg-emerald-50 px-2 py-2 text-center text-sm font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-emerald-200">
              근무집계
            </td>
            {dayInfo.map(({ day, index }) => (
              <td
                key={`dsm-h-${day}`}
                className={`border border-slate-300 px-1 py-2 text-center text-sm font-semibold dark:border-slate-600 ${getDayBgClass(index)} ${getDayTextClass(index)}`}
              >
                {day}
              </td>
            ))}
            <td
              colSpan={SUMMARY_KEYS.length + EXTRA_STAT_KEYS.length}
              className="border border-slate-300 bg-emerald-100 px-2 py-2 text-center text-sm font-bold text-slate-800 dark:border-slate-600 dark:bg-emerald-900/30 dark:text-emerald-200"
            >
              합계
            </td>
          </tr>
          {/* D, E, N, T, X rows */}
          {DAILY_SHIFT_TYPES.map((type) => (
            <tr key={`dsm-${type}`} className="bg-emerald-50/50 dark:bg-emerald-900/10">
              <td colSpan={3} className="sticky left-0 z-20 border border-slate-200 bg-emerald-50 px-2 py-1 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {type}
              </td>
              {days.map((day) => (
                <td
                  key={`dsm-${type}-${day}`}
                  className="border border-slate-200 px-1 py-1 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400"
                >
                  {dailySummary.counts[type][day] || 0}
                </td>
              ))}
              <td
                colSpan={SUMMARY_KEYS.length + EXTRA_STAT_KEYS.length}
                className="border border-slate-200 bg-emerald-100/50 px-2 py-1 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-emerald-900/20 dark:text-slate-300"
              >
                {dailySummary.totals[type]}
              </td>
            </tr>
          ))}
          {/* T + X row */}
          <tr className="bg-emerald-50/50 dark:bg-emerald-900/10">
            <td colSpan={3} className="sticky left-0 z-20 border border-slate-200 bg-emerald-50 px-2 py-1 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              T + X
            </td>
            {days.map((day) => (
              <td
                key={`dsm-tx-${day}`}
                className="border border-slate-200 px-1 py-1 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400"
              >
                {dailySummary.txCounts[day] || 0}
              </td>
            ))}
            <td
              colSpan={SUMMARY_KEYS.length + EXTRA_STAT_KEYS.length}
              className="border border-slate-200 bg-emerald-100/50 px-2 py-1 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-emerald-900/20 dark:text-slate-300"
            >
              {dailySummary.txTotal}
            </td>
          </tr>
          {/* 일별 총인원 row */}
          <tr className="bg-emerald-100 dark:bg-emerald-900/30">
            <td colSpan={3} className="sticky left-0 z-20 border border-slate-300 bg-emerald-100 px-2 py-2 text-center text-xs font-bold text-slate-800 whitespace-nowrap dark:border-slate-600 dark:bg-slate-800 dark:text-emerald-200">
              일별 총인원(명)
            </td>
            {days.map((day) => (
              <td
                key={`dsm-total-${day}`}
                className="border border-slate-300 px-1 py-2 text-center text-sm font-bold text-slate-800 dark:border-slate-600 dark:text-emerald-200"
              >
                {dailySummary.dailyTotal[day]}
              </td>
            ))}
            <td
              colSpan={SUMMARY_KEYS.length + EXTRA_STAT_KEYS.length}
              className="border border-slate-300 bg-emerald-200/60 px-2 py-2 text-center text-sm font-bold text-slate-800 dark:border-slate-600 dark:bg-emerald-900/40 dark:text-emerald-200"
            >
              {dailySummary.grandTotal}
            </td>
          </tr>
        </tfoot>
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
  rowIndex: number;
  dayInfo: { day: number; label: string; index: number }[];
  daysInMonth: number;
  editable: boolean;
  selectionBounds: SelectionBounds | null;
  onCellSelect: (nurseId: string, day: number, shiftCode: string) => void;
  onRemove?: (nurseId: string, nurseName: string) => void;
}

const NurseRow = memo(function NurseRow({
  row,
  rowIndex,
  dayInfo,
  daysInMonth,
  editable,
  selectionBounds,
  onCellSelect,
  onRemove,
}: NurseRowProps) {
  const extraStats = useMemo(
    () => computeExtraStats(row.entries, dayInfo, daysInMonth),
    [row.entries, dayInfo, daysInMonth]
  );
  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
      {/* Sticky: employee number */}
      <td className="sticky left-0 z-10 border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs text-slate-600 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        {row.employeeNumber}
      </td>
      {/* Sticky: name */}
      <td className="sticky left-[80px] z-10 border border-slate-200 bg-white px-2 py-1 text-center font-medium text-slate-900 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        {row.nurseName}
      </td>
      {/* Sticky: position */}
      <td className="sticky left-[152px] z-10 border border-slate-200 bg-white px-2 py-1 text-center text-slate-600 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        {POSITION_LABELS[row.position] || row.position}
      </td>
      {/* Day cells */}
      {dayInfo.map(({ day }) => {
        const isSelected =
          selectionBounds !== null &&
          rowIndex >= selectionBounds.minRow &&
          rowIndex <= selectionBounds.maxRow &&
          day >= selectionBounds.minDay &&
          day <= selectionBounds.maxDay;
        return (
          <ShiftCell
            key={`${row.nurseId}-${day}`}
            nurseId={row.nurseId}
            day={day}
            rowIndex={rowIndex}
            value={row.entries[day] || ""}
            editable={editable}
            isSelected={isSelected}
            onSelect={onCellSelect}
          />
        );
      })}
      {/* Summary cells */}
      {SUMMARY_KEYS.map((key) => (
        <td
          key={`${row.nurseId}-sum-${key}`}
          className="border border-slate-200 bg-slate-50 px-1 py-1 text-center font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {row.summary[key]}
        </td>
      ))}
      {/* Extra stat cells */}
      {EXTRA_STAT_KEYS.map((key) => (
        <td
          key={`${row.nurseId}-ext-${key}`}
          className="border border-slate-200 bg-amber-50 px-1 py-1 text-center font-semibold text-amber-800 dark:border-slate-700 dark:bg-amber-900/20 dark:text-amber-200"
        >
          {extraStats[key]}
        </td>
      ))}
      {/* Delete button */}
      {onRemove && (
        <td className="border border-slate-200 px-1 py-1 text-center dark:border-slate-700">
          <button
            onClick={() => onRemove(row.nurseId, row.nurseName)}
            className="inline-flex items-center justify-center rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:hover:bg-red-900/30"
            title="삭제"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
});

const ScheduleGrid = memo(ScheduleGridInner);
ScheduleGrid.displayName = "ScheduleGrid";

export default ScheduleGrid;
