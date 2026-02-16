"use client";

import { useState, useRef, useEffect, memo, useCallback } from "react";
import { SHIFT_COLORS } from "@/lib/utils";

const SHIFT_OPTIONS = ["D", "E", "N", "O", "X", "T", "B"] as const;

const SHIFT_LABELS: Record<string, string> = {
  D: "D (주간)",
  E: "E (저녁)",
  N: "N (야간)",
  O: "O (공휴)",
  X: "X (휴무)",
  T: "T (교육)",
  B: "B (보류)",
};

interface ShiftCellProps {
  nurseId: string;
  day: number;
  rowIndex: number;
  value: string;
  editable: boolean;
  isSelected: boolean;
  onSelect: (nurseId: string, day: number, shiftCode: string) => void;
}

function ShiftCellInner({
  nurseId,
  day,
  rowIndex,
  value,
  editable,
  isSelected,
  onSelect,
}: ShiftCellProps) {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      popoverRef.current &&
      !popoverRef.current.contains(e.target as Node) &&
      cellRef.current &&
      !cellRef.current.contains(e.target as Node)
    ) {
      setShowPopover(false);
    }
  }, []);

  useEffect(() => {
    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPopover, handleClickOutside]);

  const handleCellClick = useCallback((e: React.MouseEvent) => {
    if (!editable) return;
    // Shift+Click is used for range selection extension; don't open popover
    if (e.shiftKey) return;
    setShowPopover((prev) => !prev);
  }, [editable]);

  const handleOptionSelect = useCallback(
    (shiftCode: string) => {
      onSelect(nurseId, day, shiftCode);
      setShowPopover(false);
    },
    [nurseId, day, onSelect]
  );

  const colorClass = value ? SHIFT_COLORS[value] || "bg-slate-50 text-slate-500" : "";

  return (
    <td
      ref={cellRef}
      data-row={rowIndex}
      data-day={day}
      className={`relative border border-slate-200 p-0 text-center dark:border-slate-700 ${
        editable ? "cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-inset" : ""
      } ${isSelected ? "ring-2 ring-blue-500 ring-inset" : ""}`}
      onClick={handleCellClick}
    >
      <div
        className={`flex h-8 w-10 items-center justify-center text-sm font-semibold ${colorClass}`}
      >
        {value || ""}
      </div>

      {/* Shift type selector popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-800"
          style={{ minWidth: "120px" }}
        >
          {SHIFT_OPTIONS.map((code) => (
            <button
              key={code}
              onClick={(e) => {
                e.stopPropagation();
                handleOptionSelect(code);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${
                value === code ? "bg-blue-50 font-bold dark:bg-blue-900/50" : ""
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${
                  SHIFT_COLORS[code] || ""
                }`}
              >
                {code}
              </span>
              <span className="text-slate-700 dark:text-slate-300">{SHIFT_LABELS[code]}</span>
            </button>
          ))}
          {/* Clear option */}
          {value && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOptionSelect("");
                  setShowPopover(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30"
              >
                삭제
              </button>
            </>
          )}
        </div>
      )}
    </td>
  );
}

const ShiftCell = memo(ShiftCellInner);
ShiftCell.displayName = "ShiftCell";

export default ShiftCell;
