"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Ward, Schedule } from "@prisma/client";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import { CalendarDays, Plus, Eye } from "lucide-react";

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

export default function SchedulesPage() {
  const router = useRouter();
  useSession();
  const now = new Date();

  // Filters
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterWardId, setFilterWardId] = useState("");

  // Data
  const [schedules, setSchedules] = useState<ScheduleListItem[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createWardId, setCreateWardId] = useState("");
  const [createYear, setCreateYear] = useState(now.getFullYear());
  const [createMonth, setCreateMonth] = useState(now.getMonth() + 1);
  const [creating, setCreating] = useState(false);

  // Fetch wards
  useEffect(() => {
    async function fetchWards() {
      try {
        const res = await fetch("/api/wards");
        if (res.ok) {
          const data = await res.json();
          setWards(data);
        }
      } catch {
        // ignore
      }
    }
    fetchWards();
  }, []);

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("year", String(filterYear));
      params.set("month", String(filterMonth));
      if (filterWardId) {
        params.set("wardId", filterWardId);
      }
      const res = await fetch(`/api/schedules?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, filterWardId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

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

  // Year options (current year - 1 to current year + 1)
  const yearOptions = Array.from({ length: 3 }, (_, i) => now.getFullYear() - 1 + i);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">근무표 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            월간 근무표를 조회하고 관리합니다.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          새 근무표
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm border border-gray-200">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">연도</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">월</label>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">병동</label>
          <select
            value={filterWardId}
            onChange={(e) => setFilterWardId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">전체</option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {ward.wardName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Schedule table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <CalendarDays className="mb-3 h-12 w-12" />
            <p className="text-sm">해당 조건에 맞는 근무표가 없습니다.</p>
            <p className="mt-1 text-xs text-gray-300">
              &quot;새 근무표&quot; 버튼을 눌러 근무표를 생성하세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">
                    병동
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">
                    연월
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">
                    버전
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">
                    작성자
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">
                    작성일
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map((schedule) => (
                  <tr
                    key={schedule.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {schedule.ward.wardName}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {schedule.year}년 {schedule.month}월
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600">
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
                    <td className="px-6 py-4 text-gray-600">
                      {schedule.createdBy.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(schedule.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-6 py-4 text-center">
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
              disabled={!createWardId}
            >
              생성
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              병동 <span className="text-red-500">*</span>
            </label>
            <select
              value={createWardId}
              onChange={(e) => setCreateWardId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">병동을 선택하세요</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.wardName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                연도
              </label>
              <select
                value={createYear}
                onChange={(e) => setCreateYear(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                월
              </label>
              <select
                value={createMonth}
                onChange={(e) => setCreateMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
    </div>
  );
}
