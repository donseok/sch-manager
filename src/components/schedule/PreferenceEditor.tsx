"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { SHIFT_COLORS, getDaysInMonth, getDayOfWeek } from "@/lib/utils";
import { Save, ChevronLeft, ChevronRight } from "lucide-react";
import type { ScheduleGridData } from "@/types";

interface PreferenceEntry {
  day: number;
  shiftCode: string;
  priority: string;
}

interface PreferenceEditorProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: string;
  year: number;
  month: number;
  gridData: ScheduleGridData[];
}

const SHIFT_OPTIONS = [
  { code: "", label: "-" },
  { code: "D", label: "D" },
  { code: "E", label: "E" },
  { code: "N", label: "N" },
  { code: "O", label: "O" },
  { code: "X", label: "X" },
];

const PRIORITY_OPTIONS = [
  { code: "PREFER", label: "희망", color: "text-blue-600" },
  { code: "STRONG", label: "강력", color: "text-orange-600" },
  { code: "MUST", label: "필수", color: "text-red-600" },
];

export default function PreferenceEditor({
  isOpen,
  onClose,
  scheduleId,
  year,
  month,
  gridData,
}: PreferenceEditorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedNurseIdx, setSelectedNurseIdx] = useState(0);
  const [preferences, setPreferences] = useState<Map<string, PreferenceEntry[]>>(
    new Map()
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const daysInMonth = getDaysInMonth(year, month);
  const rnNurses = gridData;
  const currentNurse = rnNurses[selectedNurseIdx];

  // 기존 희망 로드
  useEffect(() => {
    if (!isOpen) return;
    const fetchPreferences = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/schedules/${scheduleId}/preferences`);
        if (res.ok) {
          const data = await res.json();
          const map = new Map<string, PreferenceEntry[]>();
          for (const pref of data) {
            if (!map.has(pref.nurseId)) map.set(pref.nurseId, []);
            map.get(pref.nurseId)!.push({
              day: pref.day,
              shiftCode: pref.shiftCode,
              priority: pref.priority,
            });
          }
          setPreferences(map);
        }
      } catch {
        console.error("Failed to load preferences");
      } finally {
        setLoading(false);
      }
    };
    fetchPreferences();
  }, [isOpen, scheduleId]);

  // 희망 수정
  const updatePreference = useCallback(
    (nurseId: string, day: number, field: "shiftCode" | "priority", value: string) => {
      setPreferences((prev) => {
        const map = new Map(prev);
        const entries = [...(map.get(nurseId) || [])];
        const existing = entries.find((e) => e.day === day);

        if (field === "shiftCode" && value === "") {
          // 제거
          map.set(
            nurseId,
            entries.filter((e) => e.day !== day)
          );
        } else if (existing) {
          existing[field] = value;
          map.set(nurseId, entries);
        } else {
          entries.push({
            day,
            shiftCode: field === "shiftCode" ? value : "O",
            priority: field === "priority" ? value : "PREFER",
          });
          map.set(nurseId, entries);
        }
        return map;
      });
    },
    []
  );

  // 간호사별 저장
  const handleSave = useCallback(async () => {
    if (!currentNurse) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const nursePrefs = preferences.get(currentNurse.nurseId) || [];
      const res = await fetch(`/api/schedules/${scheduleId}/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nurseId: currentNurse.nurseId,
          preferences: nursePrefs,
        }),
      });
      if (res.ok) {
        setSaveMessage("저장되었습니다.");
        setTimeout(() => setSaveMessage(null), 2000);
      } else {
        setSaveMessage("저장 실패");
      }
    } catch {
      setSaveMessage("저장 실패");
    } finally {
      setSaving(false);
    }
  }, [currentNurse, preferences, scheduleId]);

  // 전체 저장
  const handleSaveAll = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      for (const nurse of rnNurses) {
        const nursePrefs = preferences.get(nurse.nurseId) || [];
        await fetch(`/api/schedules/${scheduleId}/preferences`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nurseId: nurse.nurseId,
            preferences: nursePrefs,
          }),
        });
      }
      setSaveMessage("전체 저장 완료");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch {
      setSaveMessage("저장 실패");
    } finally {
      setSaving(false);
    }
  }, [rnNurses, preferences, scheduleId]);

  if (!isOpen) return null;

  const currentPrefs = currentNurse
    ? preferences.get(currentNurse.nurseId) || []
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`희망 근무 입력 - ${year}년 ${month}월`}
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-sm text-slate-500">
            {saveMessage && (
              <span
                className={
                  saveMessage.includes("실패")
                    ? "text-red-500"
                    : "text-green-600"
                }
              >
                {saveMessage}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
            <Button onClick={handleSave} loading={saving} size="sm">
              <Save className="mr-1 h-4 w-4" />
              현재 간호사 저장
            </Button>
            <Button onClick={handleSaveAll} loading={saving} size="sm">
              전체 저장
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
        <div className="space-y-4">
          {/* 간호사 선택 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedNurseIdx(Math.max(0, selectedNurseIdx - 1))}
              disabled={selectedNurseIdx === 0}
              className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <select
              value={selectedNurseIdx}
              onChange={(e) => setSelectedNurseIdx(Number(e.target.value))}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {rnNurses.map((nurse, idx) => {
                const prefs = preferences.get(nurse.nurseId) || [];
                return (
                  <option key={nurse.nurseId} value={idx}>
                    {nurse.employeeNumber} - {nurse.nurseName} ({nurse.position})
                    {prefs.length > 0 ? ` [${prefs.length}건]` : ""}
                  </option>
                );
              })}
            </select>
            <button
              onClick={() =>
                setSelectedNurseIdx(Math.min(rnNurses.length - 1, selectedNurseIdx + 1))
              }
              disabled={selectedNurseIdx >= rnNurses.length - 1}
              className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* 캘린더 형태 */}
          {currentNurse && (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="w-14 px-2 py-1.5 text-left text-slate-600 dark:text-slate-400">
                      일
                    </th>
                    <th className="w-10 px-2 py-1.5 text-left text-slate-600 dark:text-slate-400">
                      요일
                    </th>
                    <th className="px-2 py-1.5 text-left text-slate-600 dark:text-slate-400">
                      희망 근무
                    </th>
                    <th className="px-2 py-1.5 text-left text-slate-600 dark:text-slate-400">
                      우선순위
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                    (day) => {
                      const dow = getDayOfWeek(year, month, day);
                      const dowIdx = new Date(year, month - 1, day).getDay();
                      const isWeekend = dowIdx === 0 || dowIdx === 6;
                      const pref = currentPrefs.find((p) => p.day === day);

                      return (
                        <tr
                          key={day}
                          className={`border-b border-slate-100 dark:border-slate-700/50 ${
                            isWeekend
                              ? "bg-red-50/50 dark:bg-red-900/10"
                              : ""
                          }`}
                        >
                          <td className="px-2 py-1 font-medium text-slate-700 dark:text-slate-300">
                            {day}
                          </td>
                          <td
                            className={`px-2 py-1 ${
                              isWeekend
                                ? "font-medium text-red-500"
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {dow}
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex gap-1">
                              {SHIFT_OPTIONS.map(({ code, label }) => (
                                <button
                                  key={code || "none"}
                                  onClick={() =>
                                    updatePreference(
                                      currentNurse.nurseId,
                                      day,
                                      "shiftCode",
                                      code
                                    )
                                  }
                                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                                    pref?.shiftCode === code ||
                                    (!pref && code === "")
                                      ? code
                                        ? `${SHIFT_COLORS[code]} ring-2 ring-blue-400`
                                        : "bg-slate-200 ring-2 ring-blue-400 dark:bg-slate-600"
                                      : code
                                      ? `${SHIFT_COLORS[code]} opacity-40 hover:opacity-70`
                                      : "bg-slate-100 opacity-40 hover:opacity-70 dark:bg-slate-700"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            {pref?.shiftCode && (
                              <select
                                value={pref.priority}
                                onChange={(e) =>
                                  updatePreference(
                                    currentNurse.nurseId,
                                    day,
                                    "priority",
                                    e.target.value
                                  )
                                }
                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                              >
                                {PRIORITY_OPTIONS.map((opt) => (
                                  <option key={opt.code} value={opt.code}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
