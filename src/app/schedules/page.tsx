"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Ward, Schedule } from "@prisma/client";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import { CalendarDays, Plus, Eye, Trash2, Search } from "lucide-react";

type ScheduleListItem = Schedule & {
  ward: Ward;
  createdBy: { id: string; name: string };
};

function getStatusBadgeVariant(
  status: string
): "default" | "primary" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "DRAFT":
      return "default";
    case "PENDING_MANAGER":
      return "warning";
    case "PENDING_DIRECTOR":
      return "warning";
    case "APPROVED":
      return "info";
    case "CONFIRMED":
      return "success";
    case "REVISED":
      return "danger";
    default:
      return "default";
  }
}

function SchedulesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const initialSearchDone = useRef(false);

  // Filters — restore from URL search params if present
  const [filterYear, setFilterYear] = useState(() => {
    const v = searchParams.get("year");
    return v ? Number(v) : now.getFullYear();
  });
  const [filterMonth, setFilterMonth] = useState(() => {
    const v = searchParams.get("month");
    return v ? Number(v) : now.getMonth() + 1;
  });
  const [filterWardId, setFilterWardId] = useState(
    searchParams.get("wardId") || ""
  );

  // Data
  const [schedules, setSchedules] = useState<ScheduleListItem[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createWardId, setCreateWardId] = useState("");
  const [createYear, setCreateYear] = useState(now.getFullYear());
  const [createMonth, setCreateMonth] = useState(now.getMonth() + 1);
  const [creating, setCreating] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<ScheduleListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch wards & auto-select 42병동
  useEffect(() => {
    async function fetchWards() {
      try {
        const res = await fetch("/api/wards");
        if (res.ok) {
          const data = await res.json();
          setWards(data);
          const ward42 = data.find((w: Ward) => w.wardName === "42병동");
          if (ward42) {
            setCreateWardId(ward42.id);
          }
        }
      } catch {
        // ignore
      }
    }
    fetchWards();
  }, []);

  // Fetch schedules (called only by search button or after delete)
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("year", String(filterYear));
      params.set("month", String(filterMonth));
      if (filterWardId) {
        params.set("wardId", filterWardId);
      }
      // Persist filter state in URL for back-navigation
      router.replace(`/schedules?${params.toString()}`, { scroll: false });

      const res = await fetch(`/api/schedules?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [filterYear, filterMonth, filterWardId, router]);

  // Auto-search on mount if returning from detail page (URL has search params)
  useEffect(() => {
    if (!initialSearchDone.current && searchParams.get("year")) {
      initialSearchDone.current = true;
      fetchSchedules();
    }
  }, [fetchSchedules, searchParams]);

  // Create schedule
  const handleCreate = async () => {
    if (!createWardId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wardId: createWardId,
          year: createYear,
          month: createMonth,
        }),
      });
      if (res.ok) {
        const schedule = await res.json();
        setShowCreateModal(false);
        setCreateWardId("");
        router.push(`/schedules/${schedule.id}/edit`);
      } else {
        const err = await res.json();
        alert(err.error || "근무표 생성에 실패했습니다.");
      }
    } catch {
      alert("근무표 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  // Delete schedule
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/schedules/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchSchedules();
      } else {
        const err = await res.json();
        alert(err.error || "삭제에 실패했습니다.");
      }
    } catch {
      alert("삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  // Year options (current year - 1 to current year + 1)
  const yearOptions = Array.from({ length: 3 }, (_, i) => now.getFullYear() - 1 + i);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Page header - fixed */}
      <div className="shrink-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">근무표 관리</h1>
          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
            월간 근무표를 조회하고 관리합니다.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          새 근무표
        </Button>
      </div>

      {/* Filters - fixed */}
      <div className="shrink-0 flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <label className="text-base font-medium text-slate-700 dark:text-slate-300">연도</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-base font-medium text-slate-700 dark:text-slate-300">월</label>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-base font-medium text-slate-700 dark:text-slate-300">병동</label>
          <select
            value={filterWardId}
            onChange={(e) => setFilterWardId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
          >
            <option value="">전체</option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {ward.wardName}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={fetchSchedules} loading={loading} size="sm">
          <Search className="mr-1.5 h-4 w-4" />
          조회
        </Button>
      </div>

      {/* Schedule table - scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : !searched ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Search className="mb-3 h-12 w-12" />
            <p className="text-base">조건을 선택하고 조회 버튼을 눌러주세요.</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <CalendarDays className="mb-3 h-12 w-12" />
            <p className="text-base">해당 조건에 맞는 근무표가 없습니다.</p>
            <p className="mt-1 text-sm text-slate-300">
              &quot;새 근무표&quot; 버튼을 눌러 근무표를 생성하세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:bg-slate-700/50 dark:border-slate-700">
                  <th className="px-6 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    병동
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    연월
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                    버전
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    작성자
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    작성일
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {schedules.map((schedule) => (
                  <tr
                    key={schedule.id}
                    className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-700/50"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                      {schedule.ward.wardName}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {schedule.year}년 {schedule.month}월
                    </td>
                    <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-300">
                      v{schedule.version}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge
                        className={STATUS_COLORS[schedule.status] || ""}
                        variant={getStatusBadgeVariant(schedule.status)}
                      >
                        {STATUS_LABELS[schedule.status] || schedule.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {schedule.createdBy.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {new Date(schedule.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(`/schedules/${schedule.id}/edit`)
                          }
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          보기
                        </Button>
                        {schedule.status !== "CONFIRMED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => setDeleteTarget(schedule)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            삭제
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="새 근무표 생성"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleCreate}
              loading={creating}
            >
              생성
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-base font-medium text-slate-700 dark:text-slate-300">
              병동
            </label>
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
              42병동
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-base font-medium text-slate-700 dark:text-slate-300">
                연도
              </label>
              <select
                value={createYear}
                onChange={(e) => setCreateYear(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-base font-medium text-slate-700 dark:text-slate-300">
                월
              </label>
              <select
                value={createMonth}
                onChange={(e) => setCreateMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="근무표 삭제"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              삭제
            </Button>
          </>
        }
      >
        <p className="text-base text-slate-600 dark:text-slate-300">
          <strong>{deleteTarget?.ward.wardName}</strong>의{" "}
          <strong>{deleteTarget?.year}년 {deleteTarget?.month}월</strong> 근무표(v{deleteTarget?.version})를
          삭제하시겠습니까?
        </p>
        <p className="mt-2 text-sm text-red-500">
          삭제된 근무표는 복구할 수 없으며, 관련된 모든 데이터가 함께 삭제됩니다.
        </p>
      </Modal>
    </div>
  );
}

export default function SchedulesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    }>
      <SchedulesContent />
    </Suspense>
  );
}
