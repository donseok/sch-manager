"use client";

import { useState, useRef, useEffect, memo, useCallback } from "react";
import { SHIFT_COLORS } from "@/lib/utils";

const SHIFT_OPTIONS = ["D", "E", "N", "O", "X", "T", "M", "CS2", "C6", "B"] as const;

const SHIFT_LABELS: Record<string, string> = {
  D: "D (주간)",
  E: "E (저녁)",
  N: "N (야간)",
  O: "O (공휴)",
  X: "X (휴무)",
  T: "T (교육)",
  M: "M (공휴)",
  CS2: "CS2 (공휴)",
  C6: "C6 (공휴)",
  B: "B (공휴)",
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
  const [isEditing, setIsEditing] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Cleanup click timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleCellClick = useCallback((e: React.MouseEvent) => {
    if (!editable) return;
    if (e.shiftKey) return;
    if (isEditing) return;

    // Delay single-click to distinguish from double-click
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    clickTimeoutRef.current = setTimeout(() => {
      setShowPopover((prev) => !prev);
      clickTimeoutRef.current = null;
    }, 200);
  }, [editable, isEditing]);

  const handleDoubleClick = useCallback(() => {
    if (!editable) return;

    // Cancel pending single-click
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    setShowPopover(false);
    setIsEditing(true);
  }, [editable]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
      onSelect(nurseId, day, val);
      setIsEditing(false);
    }
    if (e.key === "Escape") {
      setIsEditing(false);
    }
  }, [nurseId, day, onSelect]);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim().toUpperCase();
    if (val !== value) {
      onSelect(nurseId, day, val);
    }
    setIsEditing(false);
  }, [nurseId, day, value, onSelect]);

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
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          className="h-8 w-full border-2 border-blue-400 text-center text-sm font-semibold outline-none"
          defaultValue={value}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
        />
      ) : (
        <div
          className={`flex h-8 w-12 items-center justify-center text-xs font-semibold ${colorClass}`}
        >
          {value || ""}
        </div>
      )}

      {/* Shift type selector popover */}
      {showPopover && !isEditing && (
        <div
          ref={popoverRef}
          className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-800"
          style={{ minWidth: "140px" }}
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
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded px-0.5 text-[11px] font-bold ${
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
