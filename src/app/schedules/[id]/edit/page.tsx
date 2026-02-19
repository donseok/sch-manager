"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ScheduleWithRelations, ScheduleGridData } from "@/types";
import { useScheduleStore } from "@/store/schedule";
import {
  SHIFT_COLORS,
  getDaysInMonth,
  O_EQUIVALENT_CODES,
} from "@/lib/utils";
import { useReactToPrint } from "react-to-print";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import ChangeHistory from "@/components/schedule/ChangeHistory";
import PrintLayout from "@/components/schedule/PrintLayout";
import {
  Save,
  Printer,
  FileDown,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
  ChevronLeft,
  List,
  UserPlus,
  RotateCcw,
  Lock,
  Unlock,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";

const SHIFT_CODES = [
  { code: "D", label: "주간" },
  { code: "E", label: "저녁" },
  { code: "N", label: "야간" },
  { code: "O", label: "공휴" },
  { code: "X", label: "휴무" },
  { code: "T", label: "교육" },
  { code: "M", label: "공휴" },
  { code: "CS2", label: "공휴" },
  { code: "C6", label: "공휴" },
  { code: "C", label: "공휴" },
  { code: "B", label: "공휴" },
];

export default function ScheduleEditPage() {
  const params = useParams();
  const router = useRouter();
  const scheduleId = params.id as string;

  // Schedule data
  const [schedule, setSchedule] = useState<ScheduleWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Change history section
  const [showChangeHistory, setShowChangeHistory] = useState(false);

  // Previous month reference modal
  const [showPreviousModal, setShowPreviousModal] = useState(false);
  const [previousData, setPreviousData] = useState<{
    year: number;
    month: number;
    version: number;
    status: string;
    wardName: string;
    summaries: {
      nurseId: string;
      nurseName: string;
      employeeNumber: string;
      position: string;
      countD: number;
      countE: number;
      countN: number;
      countT: number;
      countX: number;
      countO: number;
      countXO: number;
    }[];
  } | null>(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  // Unsaved changes warning
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  // Reset confirmation
  const [showResetModal, setShowResetModal] = useState(false);

  // Confirm/Unconfirm
  const [confirming, setConfirming] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUnconfirmModal, setShowUnconfirmModal] = useState(false);

  const isConfirmed = schedule?.status === "CONFIRMED";

  // Add/Remove nurse
  const [showAddNurseModal, setShowAddNurseModal] = useState(false);
  const [wardNurses, setWardNurses] = useState<
    { id: string; name: string; employeeNumber: string; position: string; sortOrder: number }[]
  >([]);
  const [selectedNurseId, setSelectedNurseId] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ nurseId: string; nurseName: string } | null>(null);

  // Zustand store
  const gridData = useScheduleStore((state) => state.gridData);
  const setGridData = useScheduleStore((state) => state.setGridData);
  const isDirty = useScheduleStore((state) => state.isDirty);
  const setDirty = useScheduleStore((state) => state.setDirty);
  const addNurseToGrid = useScheduleStore((state) => state.addNurse);
  const removeNurseFromGrid = useScheduleStore((state) => state.removeNurse);

  // Print ref for react-to-print
  const printRef = useRef<HTMLDivElement>(null);

  // Transform API entries into grid data
  const transformToGridData = useCallback(
    (scheduleData: ScheduleWithRelations): ScheduleGridData[] => {
      const nurseMap = new Map<
        string,
        {
          nurseId: string;
          nurseName: string;
          employeeNumber: string;
          position: string;
          sortOrder: number;
          entries: Record<number, string>;
        }
      >();

      // Gather nurses from entries
      for (const entry of scheduleData.entries) {
        if (!nurseMap.has(entry.nurseId)) {
          nurseMap.set(entry.nurseId, {
            nurseId: entry.nurseId,
            nurseName: entry.nurse.name,
            employeeNumber: entry.nurse.employeeNumber,
            position: entry.nurse.position,
            sortOrder: entry.nurse.sortOrder,
            entries: {},
          });
        }
        const workDate = new Date(entry.workDate);
        const day = workDate.getDate();
        nurseMap.get(entry.nurseId)!.entries[day] = entry.shiftTypeCode;
      }

      // Also include nurses from summaries that might not have entries yet
      for (const summary of scheduleData.summaries) {
        if (!nurseMap.has(summary.nurseId)) {
          nurseMap.set(summary.nurseId, {
            nurseId: summary.nurseId,
            nurseName: summary.nurse.name,
            employeeNumber: summary.nurse.employeeNumber,
            position: summary.nurse.position,
            sortOrder: summary.nurse.sortOrder,
            entries: {},
          });
        }
      }

      // Calculate summaries
      const result: ScheduleGridData[] = [];
      for (const [, nurseData] of nurseMap) {
        const counts = { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0, XO: 0 };
        Object.values(nurseData.entries).forEach((code) => {
          if (O_EQUIVALENT_CODES.has(code)) {
            counts.O++;
          } else if (code in counts) {
            counts[code as keyof typeof counts]++;
          }
        });
        counts.XO = counts.X + counts.O;

        result.push({
          ...nurseData,
          summary: counts,
        });
      }

      // Sort by sortOrder
      result.sort((a, b) => a.sortOrder - b.sortOrder);

      return result;
    },
    []
  );

  // Fetch schedule data
  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`);
      if (!res.ok) {
        if (res.status === 404) {
          alert("근무표를 찾을 수 없습니다.");
          router.push("/schedules");
          return;
        }
        throw new Error("Failed to fetch schedule");
      }
      const data: ScheduleWithRelations = await res.json();
      setSchedule(data);

      // Always fetch ward nurses to ensure all appear in the grid
      const nursesRes = await fetch(`/api/nurses?wardId=${data.wardId}`);
      const wardNurseList: { id: string; name: string; employeeNumber: string; position: string; sortOrder: number }[] =
        nursesRes.ok ? await nursesRes.json() : [];

      if (data.entries.length === 0) {
        // No entries yet: all nurses start with empty entries
        const defaultGrid: ScheduleGridData[] = wardNurseList.map((nurse) => ({
          nurseId: nurse.id,
          nurseName: nurse.name,
          employeeNumber: nurse.employeeNumber,
          position: nurse.position,
          sortOrder: nurse.sortOrder,
          entries: {},
          summary: { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0, XO: 0 },
        }));
        setGridData(defaultGrid);
        setDirty(true);
      } else {
        // Has entries: transform existing data, then merge in missing ward nurses
        const gridFromEntries = transformToGridData(data);
        const existingIds = new Set(gridFromEntries.map((r) => r.nurseId));

        for (const nurse of wardNurseList) {
          if (!existingIds.has(nurse.id)) {
            gridFromEntries.push({
              nurseId: nurse.id,
              nurseName: nurse.name,
              employeeNumber: nurse.employeeNumber,
              position: nurse.position,
              sortOrder: nurse.sortOrder,
              entries: {},
              summary: { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0, XO: 0 },
            });
          }
        }

        // Re-sort by sortOrder
        gridFromEntries.sort((a, b) => a.sortOrder - b.sortOrder);
        setGridData(gridFromEntries);
      }
    } catch (error) {
      console.error("Failed to fetch schedule:", error);
      alert("근무표를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [scheduleId, router, transformToGridData, setGridData, setDirty]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Clear toast after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  // Save entries
  const handleSave = useCallback(async () => {
    if (!schedule) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const entries: { nurseId: string; day: number; shiftTypeCode: string }[] =
        [];

      for (const row of gridData) {
        for (const [dayStr, shiftCode] of Object.entries(row.entries)) {
          if (shiftCode) {
            entries.push({
              nurseId: row.nurseId,
              day: parseInt(dayStr),
              shiftTypeCode: shiftCode,
            });
          }
        }
      }

      // Send nurseIds so backend can clean up removed nurses' summaries
      const nurseIds = gridData.map((row) => row.nurseId);

      const res = await fetch(`/api/schedules/${scheduleId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, nurseIds }),
      });

      if (res.ok) {
        setDirty(false);
        setSaveMessage({ type: "success", text: "저장되었습니다." });
        const scheduleRes = await fetch(`/api/schedules/${scheduleId}`);
        if (scheduleRes.ok) {
          const updated = await scheduleRes.json();
          setSchedule(updated);
        }
      } else {
        const err = await res.json();
        setSaveMessage({
          type: "error",
          text: err.error || "저장에 실패했습니다.",
        });
      }
    } catch {
      setSaveMessage({ type: "error", text: "저장에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  }, [schedule, gridData, scheduleId, setDirty]);

  // Print handler using react-to-print
  const reactToPrint = useReactToPrint({ contentRef: printRef });

  const handlePrint = useCallback(async () => {
    try {
      await fetch(`/api/schedules/${scheduleId}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printFormat: "PRINT" }),
      });
    } catch {
      // Print log failure should not block printing
    }
    reactToPrint();
  }, [scheduleId, reactToPrint]);

  // Fetch previous month reference
  const handlePreviousMonth = useCallback(async () => {
    setLoadingPrevious(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/previous`);
      if (res.ok) {
        const data = await res.json();
        setPreviousData(data.previous);
        setShowPreviousModal(true);
      }
    } catch {
      alert("이전 월 데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoadingPrevious(false);
    }
  }, [scheduleId]);

  // Open add nurse modal: fetch ward nurses and filter out already-in-grid
  const handleOpenAddNurse = useCallback(async () => {
    if (!schedule) return;
    try {
      const res = await fetch(`/api/nurses?wardId=${schedule.wardId}`);
      if (res.ok) {
        const nurses = await res.json();
        const existingIds = new Set(gridData.map((r) => r.nurseId));
        const available = nurses
          .filter((n: { id: string }) => !existingIds.has(n.id))
          .map((n: { id: string; name: string; employeeNumber: string; position: string; sortOrder: number }) => ({
            id: n.id,
            name: n.name,
            employeeNumber: n.employeeNumber,
            position: n.position,
            sortOrder: n.sortOrder,
          }));
        setWardNurses(available);
        setSelectedNurseId(available.length > 0 ? available[0].id : "");
        setShowAddNurseModal(true);
      }
    } catch {
      alert("간호사 목록을 불러오는데 실패했습니다.");
    }
  }, [schedule, gridData]);

  // Confirm add nurse
  const handleAddNurse = useCallback(() => {
    if (!selectedNurseId || !schedule) return;
    const nurse = wardNurses.find((n) => n.id === selectedNurseId);
    if (!nurse) return;

    addNurseToGrid({
      nurseId: nurse.id,
      nurseName: nurse.name,
      employeeNumber: nurse.employeeNumber,
      position: nurse.position,
      sortOrder: nurse.sortOrder ?? 0,
      entries: {},
      summary: { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0, XO: 0 },
    });

    setShowAddNurseModal(false);
    setSelectedNurseId("");
  }, [selectedNurseId, wardNurses, schedule, addNurseToGrid]);

  // Remove nurse handler (disabled - coming soon)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRemoveNurse = useCallback((_nurseId: string, _nurseName: string) => {
    alert("준비중");
  }, []);

  // Confirm remove nurse
  const confirmRemoveNurse = useCallback(() => {
    if (!removeTarget) return;
    removeNurseFromGrid(removeTarget.nurseId);
    setRemoveTarget(null);
  }, [removeTarget, removeNurseFromGrid]);

  // Confirm schedule
  const handleConfirm = useCallback(async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSchedule(updated);
        setSaveMessage({ type: "success", text: "근무표가 확정되었습니다." });
      } else {
        const err = await res.json();
        setSaveMessage({ type: "error", text: err.error || "확정에 실패했습니다." });
      }
    } catch {
      setSaveMessage({ type: "error", text: "확정에 실패했습니다." });
    } finally {
      setConfirming(false);
      setShowConfirmModal(false);
    }
  }, [scheduleId]);

  // Unconfirm schedule
  const handleUnconfirm = useCallback(async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unconfirm" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSchedule(updated);
        setSaveMessage({ type: "success", text: "확정이 취소되었습니다." });
      } else {
        const err = await res.json();
        setSaveMessage({ type: "error", text: err.error || "확정 취소에 실패했습니다." });
      }
    } catch {
      setSaveMessage({ type: "error", text: "확정 취소에 실패했습니다." });
    } finally {
      setConfirming(false);
      setShowUnconfirmModal(false);
    }
  }, [scheduleId]);

  // Reset: clear entries for all nurses except HN/CN
  const handleReset = useCallback(() => {
    const resetGrid = gridData.map((row) => {
      if (row.position === "HN" || row.position === "CN") return row;
      return {
        ...row,
        entries: {},
        summary: { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0, XO: 0 },
      };
    });
    setGridData(resetGrid);
    setDirty(true);
    setShowResetModal(false);
  }, [gridData, setGridData, setDirty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="py-32 text-center text-slate-500">
        근무표를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 print:block print:space-y-2">
      {/* Toast notification */}
      {saveMessage && (
        <div
          className={`fixed right-6 top-20 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg transition-all ${saveMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
            }`}
        >
          {saveMessage.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span className="text-base font-medium">{saveMessage.text}</span>
        </div>
      )}

      {/* Top bar: Schedule info + Actions - fixed */}
      <div className="shrink-0 flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200 print:shadow-none print:border-0 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800 dark:border-slate-700">
        {/* Schedule info */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {schedule.ward.wardName}
          </h1>
          <span className="text-base text-slate-600 dark:text-slate-400">
            {schedule.year}년 {schedule.month}월
          </span>
          <span className="text-sm text-slate-400 dark:text-slate-500">v{schedule.version}</span>
          <Badge className={STATUS_COLORS[schedule.status] || ""}>
            {STATUS_LABELS[schedule.status] || schedule.status}
          </Badge>
          {isDirty && !isConfirmed && (
            <span className="text-sm font-medium text-orange-500">
              (저장되지 않은 변경사항)
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {/* Back to list button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <List className="mr-1 h-4 w-4" />
            목록
          </Button>

          <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />

          {/* Save button */}
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!isDirty || isConfirmed}
            size="sm"
          >
            <Save className="mr-1 h-4 w-4" />
            저장
          </Button>

          {/* Confirm / Unconfirm button */}
          {isConfirmed ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowUnconfirmModal(true)}
              loading={confirming}
            >
              <Unlock className="mr-1 h-4 w-4" />
              확정 취소
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isDirty) {
                  setSaveMessage({ type: "error", text: "저장되지 않은 변경사항이 있습니다. 먼저 저장해주세요." });
                  return;
                }
                // Validate: every nurse must have all days filled
                const days = getDaysInMonth(schedule.year, schedule.month);
                const incomplete: string[] = [];
                for (const row of gridData) {
                  for (let d = 1; d <= days; d++) {
                    if (!row.entries[d]) {
                      incomplete.push(row.nurseName);
                      break;
                    }
                  }
                }
                if (incomplete.length > 0) {
                  setSaveMessage({
                    type: "error",
                    text: `빈 근무가 있는 사원: ${incomplete.join(", ")}`,
                  });
                  return;
                }
                setShowConfirmModal(true);
              }}
              loading={confirming}
            >
              <Lock className="mr-1 h-4 w-4" />
              확정
            </Button>
          )}

          {/* Print button */}
          <Button variant="ghost" size="sm" onClick={handlePrint}>
            <Printer className="mr-1 h-4 w-4" />
            인쇄
          </Button>

          {/* Excel download button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                const res = await fetch(`/api/schedules/${scheduleId}/excel`);
                if (!res.ok) throw new Error();
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const cd = res.headers.get("Content-Disposition");
                const match = cd?.match(/filename\*=UTF-8''(.+)/);
                a.download = match ? decodeURIComponent(match[1]) : "schedule.xlsx";
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              } catch {
                alert("엑셀 다운로드에 실패했습니다.");
              }
            }}
          >
            <FileDown className="mr-1 h-4 w-4" />
            엑셀 다운로드
          </Button>

          {/* Previous month reference button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviousMonth}
            loading={loadingPrevious}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            이전 월 참조
          </Button>

          <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />

          {/* Add nurse button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenAddNurse}
            disabled={isConfirmed}
          >
            <UserPlus className="mr-1 h-4 w-4" />
            사원 추가
          </Button>

          {/* Reset button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResetModal(true)}
            disabled={isConfirmed}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            초기화
          </Button>
        </div>
      </div>

      {/* Shift type legend - fixed */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm border border-slate-200 print:shadow-none print:border-0 dark:bg-slate-800 dark:border-slate-700">
        <span className="mr-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
          근무유형:
        </span>
        {SHIFT_CODES.map(({ code, label }) => (
          <span
            key={code}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium ${SHIFT_COLORS[code] || ""
              }`}
          >
            {code}
            <span className="text-[11px] opacity-70">({label})</span>
          </span>
        ))}
      </div>

      {/* Scrollable content: Grid + Change History */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto print:overflow-visible">
      {/* Schedule Grid */}
      <ScheduleGrid
        year={schedule.year}
        month={schedule.month}
        editable={!isConfirmed}
        onRemoveNurse={isConfirmed ? undefined : handleRemoveNurse}
      />

      {/* Change History */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-200 print:shadow-none print:border-0 dark:bg-slate-800 dark:border-slate-700">
        <button
          onClick={() => setShowChangeHistory((prev) => !prev)}
          className="flex w-full items-center justify-between border-b border-slate-200 px-6 py-4 text-left hover:bg-slate-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-700/50"
        >
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <History className="h-4 w-4 text-slate-500" />
            변경 이력
          </h3>
          {showChangeHistory ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>
        {showChangeHistory && (
          <div className="p-6">
            <ChangeHistory scheduleId={schedule.id} />
          </div>
        )}
      </div>
      </div>{/* end scrollable content */}

      {/* Unsaved changes warning modal */}
      <Modal
        isOpen={showUnsavedModal}
        onClose={() => setShowUnsavedModal(false)}
        title="저장되지 않은 변경사항"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowUnsavedModal(false)}
            >
              닫기
            </Button>
            <Button onClick={handleSave} loading={saving}>
              저장하기
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <p className="text-base text-slate-600 dark:text-slate-300">
            저장되지 않은 변경사항이 있습니다. 변경사항을 저장해주세요.
          </p>
        </div>
      </Modal>

      {/* Previous month reference modal */}
      <Modal
        isOpen={showPreviousModal}
        onClose={() => setShowPreviousModal(false)}
        title="이전 월 참조"
        footer={
          <Button
            variant="secondary"
            onClick={() => setShowPreviousModal(false)}
          >
            닫기
          </Button>
        }
      >
        {previousData ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-base text-slate-600 dark:text-slate-300">
              <span className="font-medium">
                {previousData.wardName}
              </span>
              <span>
                {previousData.year}년 {previousData.month}월
              </span>
              <Badge className={STATUS_COLORS[previousData.status] || ""}>
                {STATUS_LABELS[previousData.status] || previousData.status}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-700">
                      간호사
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-yellow-700">
                      D
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-blue-700">
                      E
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-purple-700">
                      N
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-orange-700">
                      T
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-slate-600">
                      X
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-green-700">
                      O
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-slate-700">
                      X+O
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previousData.summaries.map((s) => (
                    <tr
                      key={s.nurseId}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-2 py-1.5 font-medium text-slate-900">
                        {s.nurseName}
                      </td>
                      <td className="px-2 py-1.5 text-center">{s.countD}</td>
                      <td className="px-2 py-1.5 text-center">{s.countE}</td>
                      <td className="px-2 py-1.5 text-center">{s.countN}</td>
                      <td className="px-2 py-1.5 text-center">{s.countT}</td>
                      <td className="px-2 py-1.5 text-center">{s.countX}</td>
                      <td className="px-2 py-1.5 text-center">{s.countO}</td>
                      <td className="px-2 py-1.5 text-center font-medium">
                        {s.countXO}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="py-4 text-center text-base text-slate-400">
            이전 월 근무표가 없습니다.
          </p>
        )}
      </Modal>

      {/* Add nurse modal */}
      <Modal
        isOpen={showAddNurseModal}
        onClose={() => setShowAddNurseModal(false)}
        title="사원 추가"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowAddNurseModal(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleAddNurse}
              disabled={!selectedNurseId}
            >
              추가
            </Button>
          </>
        }
      >
        {wardNurses.length > 0 ? (
          <div className="space-y-3">
            <p className="text-base text-slate-600 dark:text-slate-300">
              추가할 간호사를 선택하세요.
            </p>
            <select
              value={selectedNurseId}
              onChange={(e) => setSelectedNurseId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {wardNurses.map((nurse) => (
                <option key={nurse.id} value={nurse.id}>
                  {nurse.employeeNumber} - {nurse.name} ({nurse.position})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="py-4 text-center text-base text-slate-400">
            추가할 수 있는 간호사가 없습니다.
          </p>
        )}
      </Modal>

      {/* Remove nurse confirmation modal */}
      <Modal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="사원 삭제"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRemoveTarget(null)}
            >
              취소
            </Button>
            <Button
              variant="danger"
              onClick={confirmRemoveNurse}
            >
              삭제
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <p className="text-base text-slate-600 dark:text-slate-300">
            <strong>{removeTarget?.nurseName}</strong> 간호사를 근무표에서 삭제하시겠습니까?
          </p>
        </div>
      </Modal>

      {/* Reset confirmation modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="근무표 초기화"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowResetModal(false)}
            >
              취소
            </Button>
            <Button
              variant="danger"
              onClick={handleReset}
            >
              초기화
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <p className="text-base text-slate-600 dark:text-slate-300">
            수간호사, 책임간호사를 제외한 모든 사원의 근무 데이터를 초기화합니다. 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
          </p>
        </div>
      </Modal>

      {/* Confirm modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="근무표 확정"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowConfirmModal(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleConfirm}
              loading={confirming}
            >
              확정
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
          <p className="text-base text-slate-600 dark:text-slate-300">
            근무표를 확정하시겠습니까? 확정 후에는 수정 및 저장이 불가능합니다.
            <br />
            <span className="text-sm text-slate-400">확정 취소 버튼으로 다시 수정할 수 있습니다.</span>
          </p>
        </div>
      </Modal>

      {/* Unconfirm modal */}
      <Modal
        isOpen={showUnconfirmModal}
        onClose={() => setShowUnconfirmModal(false)}
        title="확정 취소"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowUnconfirmModal(false)}
            >
              취소
            </Button>
            <Button
              variant="danger"
              onClick={handleUnconfirm}
              loading={confirming}
            >
              확정 취소
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <Unlock className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <p className="text-base text-slate-600 dark:text-slate-300">
            근무표 확정을 취소하시겠습니까? 취소 후 수정 및 저장이 가능해집니다.
          </p>
        </div>
      </Modal>

      {/* Print Layout (hidden from screen, visible in print) */}
      <PrintLayout
        ref={printRef}
        year={schedule.year}
        month={schedule.month}
        wardName={schedule.ward.wardName}
        status={schedule.status}
        gridData={gridData}
      />
    </div>
  );
}
