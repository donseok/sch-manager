"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { getDaysInMonth, getDayOfWeek, getDayOfWeekIndex } from "@/lib/utils";
import { getKoreanHolidays } from "@/lib/korean-holidays";
import { Save, Zap, RotateCcw } from "lucide-react";
import { useScheduleStore } from "@/store/schedule";
import type { ScheduleGridData } from "@/types";

interface VacationEditorProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: string;
  year: number;
  month: number;
  gridData: ScheduleGridData[];
}

type Priority = "MUST" | "STRONG" | "PREFER";

const PRIORITY_CONFIG: { code: Priority; label: string; symbol: string; color: string; bgColor: string }[] = [
  { code: "MUST", label: "필수", symbol: "★", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/40" },
  { code: "STRONG", label: "강력", symbol: "●", color: "text-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900/40" },
  { code: "PREFER", label: "희망", symbol: "○", color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/40" },
];

export default function VacationEditor({
  isOpen,
  onClose,
  scheduleId,
  year,
  month,
  gridData,
}: VacationEditorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<Priority>("MUST");
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Map<nurseId, Map<day, Priority>>
  const [vacationMap, setVacationMap] = useState<Map<string, Map<number, Priority>>>(new Map());

  const daysInMonth = getDaysInMonth(year, month);
  const holidays = useMemo(() => new Set(getKoreanHolidays(year, month)), [year, month]);

  // Only RN/AN nurses (exclude HN/CN)
  const nurses = useMemo(
    () => gridData.filter((n) => n.position !== "HN" && n.position !== "CN"),
    [gridData]
  );

  // Day info for header
  const dayInfos = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dowIdx = getDayOfWeekIndex(year, month, day);
      const dowLabel = getDayOfWeek(year, month, day);
      const isWeekend = dowIdx === 0 || dowIdx === 6;
      const isHoliday = holidays.has(day);
      return { day, dowIdx, dowLabel, isWeekend, isHoliday, isRedDay: isWeekend || isHoliday };
    });
  }, [year, month, daysInMonth, holidays]);

  // Load existing preferences (O/X only) when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const fetchPreferences = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/schedules/${scheduleId}/preferences`);
        if (res.ok) {
          const data: { nurseId: string; day: number; shiftCode: string; priority: string }[] = await res.json();
          const map = new Map<string, Map<number, Priority>>();
          for (const pref of data) {
            if (pref.shiftCode === "O" || pref.shiftCode === "X") {
              if (!map.has(pref.nurseId)) map.set(pref.nurseId, new Map());
              map.get(pref.nurseId)!.set(pref.day, pref.priority as Priority);
            }
          }
          setVacationMap(map);
        }
      } catch {
        console.error("Failed to load preferences");
      } finally {
        setLoading(false);
      }
    };
    fetchPreferences();
  }, [isOpen, scheduleId]);

  // Clear toast
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  // Toggle cell
  const toggleCell = useCallback(
    (nurseId: string, day: number) => {
      setVacationMap((prev) => {
        const map = new Map(prev);
        const nurseMap = new Map(map.get(nurseId) || new Map());
        if (nurseMap.has(day)) {
          nurseMap.delete(day);
        } else {
          nurseMap.set(day, selectedPriority);
        }
        if (nurseMap.size === 0) {
          map.delete(nurseId);
        } else {
          map.set(nurseId, nurseMap);
        }
        return map;
      });
    },
    [selectedPriority]
  );

  // Reset all
  const handleReset = useCallback(() => {
    setVacationMap(new Map());
  }, []);

  // Save for AI (preferences API)
  const handleSaveForAI = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      for (const nurse of nurses) {
        const nurseVacations = vacationMap.get(nurse.nurseId);
        const prefs: { day: number; shiftCode: string; priority: string }[] = [];
        if (nurseVacations) {
          for (const [day, priority] of nurseVacations) {
            prefs.push({ day, shiftCode: "O", priority });
          }
        }
        await fetch(`/api/schedules/${scheduleId}/preferences`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nurseId: nurse.nurseId, preferences: prefs }),
        });
      }
      setSaveMessage({ type: "success", text: "저장 완료! AI 생성 시 자동 반영됩니다." });
    } catch {
      setSaveMessage({ type: "error", text: "저장에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  }, [nurses, vacationMap, scheduleId]);

  // Manual apply to grid
  const handleManualApply = useCallback(async () => {
    setApplying(true);
    setSaveMessage(null);
    try {
      // 1. Apply O to grid via updateCells
      const updates: { nurseId: string; day: number; shiftCode: string }[] = [];
      for (const [nurseId, dayMap] of vacationMap) {
        for (const [day] of dayMap) {
          updates.push({ nurseId, day, shiftCode: "O" });
        }
      }
      if (updates.length > 0) {
        const updateCells = useScheduleStore.getState().updateCells;
        updateCells(updates);
      }

      // 2. Also save preferences for AI persistence
      for (const nurse of nurses) {
        const nurseVacations = vacationMap.get(nurse.nurseId);
        const prefs: { day: number; shiftCode: string; priority: string }[] = [];
        if (nurseVacations) {
          for (const [day, priority] of nurseVacations) {
            prefs.push({ day, shiftCode: "O", priority });
          }
        }
        await fetch(`/api/schedules/${scheduleId}/preferences`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nurseId: nurse.nurseId, preferences: prefs }),
        });
      }

      setSaveMessage({ type: "success", text: "그리드에 반영되었습니다." });
      setTimeout(() => onClose(), 800);
    } catch {
      setSaveMessage({ type: "error", text: "반영에 실패했습니다." });
    } finally {
      setApplying(false);
    }
  }, [vacationMap, nurses, scheduleId, onClose]);

  // Count vacations per nurse
  const getVacationCount = useCallback(
    (nurseId: string) => vacationMap.get(nurseId)?.size || 0,
    [vacationMap]
  );

  // Get cell state
  const getCellPriority = useCallback(
    (nurseId: string, day: number): Priority | null => {
      return vacationMap.get(nurseId)?.get(day) || null;
    },
    [vacationMap]
  );

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`휴가 희망일 입력 - ${year}년 ${month}월`}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-sm">
            {saveMessage && (
              <span className={saveMessage.type === "error" ? "text-red-500" : "text-green-600"}>
                {saveMessage.text}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
            <Button onClick={handleSaveForAI} loading={saving} size="sm">
              <Save className="mr-1 h-4 w-4" />
              저장 (AI 반영용)
            </Button>
            <Button onClick={handleManualApply} loading={applying} size="sm" variant="primary">
              <Zap className="mr-1 h-4 w-4" />
              수동 반영 (그리드 적용)
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Priority selector + reset */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">우선순위:</span>
              {PRIORITY_CONFIG.map((p) => (
                <label
                  key={p.code}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedPriority === p.code
                      ? `${p.bgColor} ${p.color} ring-2 ring-offset-1 ring-current`
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                  onClick={() => setSelectedPriority(p.code)}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p.code}
                    checked={selectedPriority === p.code}
                    onChange={() => setSelectedPriority(p.code)}
                    className="sr-only"
                  />
                  <span>{p.symbol}</span>
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              전체 초기화
            </Button>
          </div>

          {/* Grid table */}
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <th className="sticky left-0 z-20 min-w-[80px] border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    간호사
                  </th>
                  {dayInfos.map(({ day, dowLabel, isRedDay }) => (
                    <th
                      key={day}
                      className={`min-w-[28px] border-b border-r border-slate-200 px-0.5 py-1 text-center font-medium dark:border-slate-700 ${
                        isRedDay ? "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400" : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div>{day}</div>
                      <div className="text-[10px] font-normal">{dowLabel}</div>
                    </th>
                  ))}
                  <th className="min-w-[36px] border-b border-slate-200 bg-slate-50 px-1 py-1.5 text-center font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    합계
                  </th>
                </tr>
              </thead>
              <tbody>
                {nurses.map((nurse) => (
                  <tr
                    key={nurse.nurseId}
                    className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-slate-700/50 dark:hover:bg-slate-700/20"
                  >
                    <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-2 py-1 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <span className="whitespace-nowrap">{nurse.nurseName}</span>
                    </td>
                    {dayInfos.map(({ day, isRedDay }) => {
                      const priority = getCellPriority(nurse.nurseId, day);
                      const config = priority ? PRIORITY_CONFIG.find((p) => p.code === priority) : null;
                      return (
                        <td
                          key={day}
                          onClick={() => toggleCell(nurse.nurseId, day)}
                          className={`cursor-pointer border-r border-slate-100 px-0 py-0.5 text-center transition-colors select-none dark:border-slate-700/50 ${
                            isRedDay && !priority ? "bg-red-50/50 dark:bg-red-900/10" : ""
                          } ${priority ? config?.bgColor || "" : "hover:bg-blue-50 dark:hover:bg-blue-900/20"}`}
                        >
                          {config && (
                            <span className={`text-sm font-bold ${config.color}`}>
                              {config.symbol}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-slate-200 bg-slate-50 px-1 py-1 text-center font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                      {getVacationCount(nurse.nurseId) || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            {PRIORITY_CONFIG.map((p) => (
              <span key={p.code} className="flex items-center gap-1">
                <span className={`font-bold ${p.color}`}>{p.symbol}</span>
                <span>={p.label}</span>
              </span>
            ))}
            <span className="ml-2">셀 클릭=토글</span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-red-50 border border-red-200" />
              <span>=주말/공휴일</span>
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}
