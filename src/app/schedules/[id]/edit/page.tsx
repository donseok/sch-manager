"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { ScheduleWithRelations, ScheduleGridData, SessionUser } from "@/types";
import { useScheduleStore } from "@/store/schedule";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  SHIFT_COLORS,
} from "@/lib/utils";
import { useReactToPrint } from "react-to-print";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import ApprovalHistory from "@/components/schedule/ApprovalHistory";
import ChangeHistory from "@/components/schedule/ChangeHistory";
import PrintLayout from "@/components/schedule/PrintLayout";
import {
  Save,
  Printer,
  Send,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
  ChevronLeft,
} from "lucide-react";

const SHIFT_CODES = [
  { code: "D", label: "주간" },
  { code: "E", label: "저녁" },
  { code: "N", label: "야간" },
  { code: "O", label: "공휴" },
  { code: "X", label: "휴무" },
  { code: "T", label: "교육" },
  { code: "B", label: "보류" },
];

export default function ScheduleEditPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const scheduleId = params.id as string;

  // Schedule data
  const [schedule, setSchedule] = useState<ScheduleWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Approval modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"SUBMIT" | "APPROVE" | "REJECT">("SUBMIT");
  const [approvalComment, setApprovalComment] = useState("");
  const [approving, setApproving] = useState(false);

  // Approval history section
  const [showHistory, setShowHistory] = useState(false);

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

  // Zustand store
  const gridData = useScheduleStore((state) => state.gridData);
  const setGridData = useScheduleStore((state) => state.setGridData);
  const isDirty = useScheduleStore((state) => state.isDirty);
  const setDirty = useScheduleStore((state) => state.setDirty);

  const user = session?.user as SessionUser | undefined;

  // Print ref for react-to-print
  const printRef = useRef<HTMLDivElement>(null);

  // Determine editability based on status
  const isEditable = useMemo(() => {
    if (!schedule) return false;
    return schedule.status === "DRAFT" || schedule.status === "REVISED";
  }, [schedule]);

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
            entries: {},
          });
        }
      }

      // Calculate summaries
      const result: ScheduleGridData[] = [];
      for (const [, nurseData] of nurseMap) {
        const counts = { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0, XO: 0 };
        Object.values(nurseData.entries).forEach((code) => {
          if (code in counts) {
            counts[code as keyof typeof counts]++;
          }
        });
        counts.XO = counts.X + counts.O;

        result.push({
          ...nurseData,
          summary: counts,
        });
      }

      // Sort by position rank then employee number
      result.sort((a, b) => {
        if (a.employeeNumber < b.employeeNumber) return -1;
        if (a.employeeNumber > b.employeeNumber) return 1;
        return 0;
      });

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

      // If there are no entries yet, fetch nurses from the ward
      if (data.entries.length === 0) {
        // Fetch nurses for this ward to populate empty grid
        const nursesRes = await fetch(`/api/nurses?wardId=${data.wardId}`);
        if (nursesRes.ok) {
          const nurses = await nursesRes.json();
          const emptyGrid: ScheduleGridData[] = nurses.map(
            (nurse: { id: string; name: string; employeeNumber: string; position: string }) => ({
              nurseId: nurse.id,
              nurseName: nurse.name,
              employeeNumber: nurse.employeeNumber,
              position: nurse.position,
              entries: {},
              summary: { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0, XO: 0 },
            })
          );
          setGridData(emptyGrid);
        }
      } else {
        const gridData = transformToGridData(data);
        setGridData(gridData);
      }
    } catch (error) {
      console.error("Failed to fetch schedule:", error);
      alert("근무표를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [scheduleId, router, transformToGridData, setGridData]);

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
      // Collect all entries from grid data
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

      const res = await fetch(`/api/schedules/${scheduleId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });

      if (res.ok) {
        setDirty(false);
        setSaveMessage({ type: "success", text: "저장되었습니다." });
        // Refresh schedule to get updated data
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

  // Approval actions
  const handleApprovalAction = useCallback(
    (action: "SUBMIT" | "APPROVE" | "REJECT") => {
      // If there are unsaved changes, warn before approval actions
      if (isDirty) {
        setShowUnsavedModal(true);
        return;
      }
      setApprovalAction(action);
      setApprovalComment("");
      setShowApprovalModal(true);
    },
    [isDirty]
  );

  const handleApprovalSubmit = useCallback(async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approvalAction,
          comment: approvalComment || undefined,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setShowApprovalModal(false);
        setSaveMessage({
          type: "success",
          text: result.message || "처리되었습니다.",
        });
        // Refresh schedule
        await fetchSchedule();
      } else {
        const err = await res.json();
        alert(err.error || "처리에 실패했습니다.");
      }
    } catch {
      alert("처리에 실패했습니다.");
    } finally {
      setApproving(false);
    }
  }, [scheduleId, approvalAction, approvalComment, fetchSchedule]);

  // Print handler using react-to-print
  const reactToPrint = useReactToPrint({ contentRef: printRef });

  const handlePrint = useCallback(async () => {
    try {
      // Record print log
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

  // Approval action labels
  const getApprovalActionLabel = useCallback(
    (action: "SUBMIT" | "APPROVE" | "REJECT") => {
      switch (action) {
        case "SUBMIT":
          return "확정 요청";
        case "APPROVE":
          return "승인";
        case "REJECT":
          return "반려";
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="py-32 text-center text-gray-500">
        근무표를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Toast notification */}
      {saveMessage && (
        <div
          className={`fixed right-6 top-20 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg transition-all ${
            saveMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {saveMessage.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">{saveMessage.text}</span>
        </div>
      )}

      {/* Top bar: Schedule info + Actions */}
      <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm border border-gray-200 print:shadow-none print:border-0 sm:flex-row sm:items-center sm:justify-between">
        {/* Schedule info */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">
            {schedule.ward.wardName}
          </h1>
          <span className="text-sm text-gray-600">
            {schedule.year}년 {schedule.month}월
          </span>
          <Badge className={STATUS_COLORS[schedule.status] || ""}>
            {STATUS_LABELS[schedule.status] || schedule.status}
          </Badge>
          <span className="text-xs text-gray-400">v{schedule.version}</span>
          {isDirty && (
            <span className="text-xs font-medium text-orange-500">
              (저장되지 않은 변경사항)
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {/* Save button (only when editable) */}
          {isEditable && (
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!isDirty}
              size="sm"
            >
              <Save className="mr-1 h-4 w-4" />
              저장
            </Button>
          )}

          {/* Submit for approval (HEAD_NURSE + DRAFT) */}
          {schedule.status === "DRAFT" && user?.role === "HEAD_NURSE" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleApprovalAction("SUBMIT")}
            >
              <Send className="mr-1 h-4 w-4" />
              확정 요청
            </Button>
          )}

          {/* Approve / Reject (NURSING_MANAGER + PENDING_MANAGER) */}
          {schedule.status === "PENDING_MANAGER" &&
            user?.role === "NURSING_MANAGER" && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleApprovalAction("APPROVE")}
                >
                  <CheckCircle className="mr-1 h-4 w-4" />
                  승인
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleApprovalAction("REJECT")}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  반려
                </Button>
              </>
            )}

          {/* Approve / Reject (NURSING_DIRECTOR + PENDING_DIRECTOR) */}
          {schedule.status === "PENDING_DIRECTOR" &&
            user?.role === "NURSING_DIRECTOR" && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleApprovalAction("APPROVE")}
                >
                  <CheckCircle className="mr-1 h-4 w-4" />
                  승인
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleApprovalAction("REJECT")}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  반려
                </Button>
              </>
            )}

          {/* Print button */}
          <Button variant="ghost" size="sm" onClick={handlePrint}>
            <Printer className="mr-1 h-4 w-4" />
            인쇄
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
        </div>
      </div>

      {/* Shift type legend */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-200 print:shadow-none print:border-0">
        <span className="mr-2 text-xs font-semibold text-gray-600">
          근무유형:
        </span>
        {SHIFT_CODES.map(({ code, label }) => (
          <span
            key={code}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
              SHIFT_COLORS[code] || ""
            }`}
          >
            {code}
            <span className="text-[10px] opacity-70">({label})</span>
          </span>
        ))}
      </div>

      {/* CONFIRMED status notice */}
      {schedule.status === "CONFIRMED" && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>
            이 근무표는 확정되었습니다. 수정이 불가능합니다.
          </span>
        </div>
      )}

      {/* Schedule Grid */}
      <ScheduleGrid
        year={schedule.year}
        month={schedule.month}
        editable={isEditable}
      />

      {/* Approval History */}
      {schedule.approvals && schedule.approvals.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 print:shadow-none print:border-0">
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className="flex w-full items-center justify-between border-b border-gray-200 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <h3 className="text-sm font-semibold text-gray-900">
              승인 이력 ({schedule.approvals.length})
            </h3>
            {showHistory ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {showHistory && (
            <div className="p-6">
              <ApprovalHistory approvals={schedule.approvals} />
            </div>
          )}
        </div>
      )}

      {/* Change History (only show for non-DRAFT schedules) */}
      {schedule.status !== "DRAFT" && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 print:shadow-none print:border-0">
          <button
            onClick={() => setShowChangeHistory((prev) => !prev)}
            className="flex w-full items-center justify-between border-b border-gray-200 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <History className="h-4 w-4 text-gray-500" />
              변경 이력
            </h3>
            {showChangeHistory ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {showChangeHistory && (
            <div className="p-6">
              <ChangeHistory scheduleId={schedule.id} />
            </div>
          )}
        </div>
      )}

      {/* Approval Action Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title={getApprovalActionLabel(approvalAction)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowApprovalModal(false)}
            >
              취소
            </Button>
            <Button
              variant={approvalAction === "REJECT" ? "danger" : "primary"}
              onClick={handleApprovalSubmit}
              loading={approving}
            >
              {getApprovalActionLabel(approvalAction)}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {approvalAction === "SUBMIT" && (
              <>이 근무표를 간호과장에게 확정 요청하시겠습니까?</>
            )}
            {approvalAction === "APPROVE" && (
              <>이 근무표를 승인하시겠습니까?</>
            )}
            {approvalAction === "REJECT" && (
              <>이 근무표를 반려하시겠습니까? 반려 시 작성중 상태로 돌아갑니다.</>
            )}
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              코멘트 {approvalAction === "REJECT" && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              rows={3}
              placeholder={
                approvalAction === "REJECT"
                  ? "반려 사유를 입력하세요..."
                  : "코멘트를 입력하세요 (선택사항)"
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>

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
          <p className="text-sm text-gray-600">
            저장되지 않은 변경사항이 있습니다. 승인 절차를 진행하기 전에 먼저
            변경사항을 저장해주세요.
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
            <div className="flex items-center gap-2 text-sm text-gray-600">
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
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="whitespace-nowrap px-2 py-1.5 font-semibold text-gray-700">
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
                    <th className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-gray-600">
                      X
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-green-700">
                      O
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-gray-700">
                      X+O
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previousData.summaries.map((s) => (
                    <tr
                      key={s.nurseId}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-2 py-1.5 font-medium text-gray-900">
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
          <p className="py-4 text-center text-sm text-gray-400">
            이전 월 근무표가 없습니다.
          </p>
        )}
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
