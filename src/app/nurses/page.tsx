"use client";

import { useState, useEffect, useCallback } from "react";
import type { Nurse, Ward } from "@prisma/client";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import NurseFormModal from "@/components/ui/NurseFormModal";
import { POSITION_LABELS } from "@/lib/utils";
import { Search, Plus, Users } from "lucide-react";

type NurseWithWard = Nurse & { ward: Ward };

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  ACTIVE: { label: "재직", variant: "success" },
  LEAVE: { label: "휴직", variant: "warning" },
  RESIGNED: { label: "퇴직", variant: "danger" },
};

export default function NursesPage() {
  const [nurses, setNurses] = useState<NurseWithWard[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState("");
  const [selectedWardId, setSelectedWardId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNurse, setEditingNurse] = useState<Nurse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NurseWithWard | null>(null);

  const fetchWards = useCallback(async () => {
    try {
      const res = await fetch("/api/wards");
      if (res.ok) {
        const data = await res.json();
        setWards(data);
      }
    } catch (error) {
      console.error("Failed to fetch wards:", error);
    }
  }, []);

  const fetchNurses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedWardId) {
        params.set("wardId", selectedWardId);
      }
      // Fetch all statuses by not sending status param, or handle on server
      // The API defaults to ACTIVE, so we fetch all and filter client-side for search
      params.set("status", "ACTIVE");

      const res = await fetch(`/api/nurses?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNurses(data);
      }
    } catch (error) {
      console.error("Failed to fetch nurses:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedWardId]);

  useEffect(() => {
    fetchWards();
  }, [fetchWards]);

  useEffect(() => {
    fetchNurses();
  }, [fetchNurses]);

  const filteredNurses = nurses.filter((nurse) => {
    if (searchName && !nurse.name.includes(searchName)) {
      return false;
    }
    return true;
  });

  const handleCreate = () => {
    setEditingNurse(null);
    setIsModalOpen(true);
  };

  const handleEdit = (nurse: NurseWithWard) => {
    setEditingNurse(nurse);
    setIsModalOpen(true);
  };

  const handleDelete = (nurse: NurseWithWard) => {
    setDeleteTarget(nurse);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`/api/nurses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchNurses();
      } else {
        const data = await res.json();
        alert(data.error || "삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("Failed to delete nurse:", error);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const positionRankMap: Record<string, number> = {
    HN: 1,
    CN: 2,
    AN: 3,
    RN: 4,
  };

  const handleSave = async (formData: {
    employeeNumber: string;
    name: string;
    position: string;
    wardId: string;
    hireDate: string;
    sortOrder: number;
  }) => {
    const body = {
      ...formData,
      positionRank: positionRankMap[formData.position] ?? 0,
      hireDate: formData.hireDate || null,
    };

    try {
      let res: Response;
      if (editingNurse) {
        res = await fetch(`/api/nurses/${editingNurse.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/nurses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        setIsModalOpen(false);
        setEditingNurse(null);
        await fetchNurses();
      } else {
        const data = await res.json();
        alert(data.error || "저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("Failed to save nurse:", error);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page title and action */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">간호사 관리</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          신규 등록
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="이름으로 검색"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Ward filter */}
        <select
          value={selectedWardId}
          onChange={(e) => setSelectedWardId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체 병동</option>
          {wards.map((ward) => (
            <option key={ward.id} value={ward.id}>
              {ward.wardName}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : filteredNurses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users className="mb-3 h-12 w-12" />
            <p className="text-sm">등록된 간호사가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    사원번호
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    사원명
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    직위
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    병동
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    상태
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredNurses.map((nurse) => {
                  const statusConfig =
                    STATUS_CONFIG[nurse.employmentStatus] || STATUS_CONFIG.ACTIVE;
                  return (
                    <tr
                      key={nurse.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-700">
                        {nurse.employeeNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {nurse.name}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {POSITION_LABELS[nurse.position] || nurse.position}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {nurse.ward.wardName}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(nurse)}
                          >
                            수정
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(nurse)}
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <NurseFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingNurse(null);
        }}
        onSave={handleSave}
        nurse={editingNurse}
        wards={wards}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              삭제 확인
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              <span className="font-medium">{deleteTarget.name}</span> 간호사를
              퇴직 처리하시겠습니까?
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </Button>
              <Button variant="danger" onClick={confirmDelete}>
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
