"use client";

import { useState, useEffect } from "react";
import type { Nurse, Ward } from "@prisma/client";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { POSITION_LABELS } from "@/lib/utils";

interface NurseFormData {
  employeeNumber: string;
  name: string;
  position: string;
  wardId: string;
  hireDate: string;
  sortOrder: number;
}

interface NurseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NurseFormData) => Promise<void>;
  nurse?: Nurse | null;
  wards: Ward[];
}

export default function NurseFormModal({
  isOpen,
  onClose,
  onSave,
  nurse,
  wards,
}: NurseFormModalProps) {
  const [formData, setFormData] = useState<NurseFormData>({
    employeeNumber: "",
    name: "",
    position: "",
    wardId: "",
    hireDate: "",
    sortOrder: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const ward42 = wards.find((w) => w.wardName === "42병동");
      if (nurse) {
        setFormData({
          employeeNumber: nurse.employeeNumber,
          name: nurse.name,
          position: nurse.position,
          wardId: nurse.wardId,
          hireDate: nurse.hireDate
            ? new Date(nurse.hireDate).toISOString().split("T")[0]
            : "",
          sortOrder: nurse.sortOrder,
        });
      } else {
        setFormData({
          employeeNumber: "",
          name: "",
          position: "",
          wardId: ward42?.id || "",
          hireDate: "",
          sortOrder: 0,
        });
      }
      setErrors({});
    }
  }, [isOpen, nurse, wards]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.employeeNumber.trim()) {
      newErrors.employeeNumber = "사원번호를 입력해주세요.";
    }
    if (!formData.name.trim()) {
      newErrors.name = "사원명을 입력해주세요.";
    }
    if (!formData.position) {
      newErrors.position = "직위를 선택해주세요.";
    }
    if (!formData.wardId) {
      newErrors.wardId = "병동을 선택해주세요.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "sortOrder" ? parseInt(value) || 0 : value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const isEdit = !!nurse;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "간호사 정보 수정" : "간호사 신규 등록"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? "수정" : "등록"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 사원번호 */}
        <div>
          <label
            htmlFor="employeeNumber"
            className="block text-base font-medium text-slate-700 mb-1 dark:text-slate-300"
          >
            사원번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="employeeNumber"
            name="employeeNumber"
            value={formData.employeeNumber}
            onChange={handleChange}
            className={`w-full rounded-lg border px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 ${
              errors.employeeNumber
                ? "border-red-300 focus:ring-red-500"
                : "border-slate-300 dark:border-slate-600"
            }`}
            placeholder="사원번호를 입력하세요"
          />
          {errors.employeeNumber && (
            <p className="mt-1 text-sm text-red-500">{errors.employeeNumber}</p>
          )}
        </div>

        {/* 사원명 */}
        <div>
          <label
            htmlFor="name"
            className="block text-base font-medium text-slate-700 mb-1 dark:text-slate-300"
          >
            사원명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full rounded-lg border px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 ${
              errors.name
                ? "border-red-300 focus:ring-red-500"
                : "border-slate-300 dark:border-slate-600"
            }`}
            placeholder="사원명을 입력하세요"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* 직위 */}
        <div>
          <label
            htmlFor="position"
            className="block text-base font-medium text-slate-700 mb-1 dark:text-slate-300"
          >
            직위 <span className="text-red-500">*</span>
          </label>
          <select
            id="position"
            name="position"
            value={formData.position}
            onChange={handleChange}
            className={`w-full rounded-lg border px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 ${
              errors.position
                ? "border-red-300 focus:ring-red-500"
                : "border-slate-300 dark:border-slate-600"
            }`}
          >
            <option value="">직위를 선택하세요</option>
            {Object.entries(POSITION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          {errors.position && (
            <p className="mt-1 text-sm text-red-500">{errors.position}</p>
          )}
        </div>

        {/* 병동 - 42병동 고정 */}
        <div>
          <label
            className="block text-base font-medium text-slate-700 mb-1 dark:text-slate-300"
          >
            병동
          </label>
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
            42병동
          </div>
        </div>

        {/* 입사일 */}
        <div>
          <label
            htmlFor="hireDate"
            className="block text-base font-medium text-slate-700 mb-1 dark:text-slate-300"
          >
            입사일
          </label>
          <input
            type="date"
            id="hireDate"
            name="hireDate"
            value={formData.hireDate}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
          />
        </div>

        {/* 정렬순서 */}
        <div>
          <label
            htmlFor="sortOrder"
            className="block text-base font-medium text-slate-700 mb-1 dark:text-slate-300"
          >
            정렬순서
          </label>
          <input
            type="number"
            id="sortOrder"
            name="sortOrder"
            value={formData.sortOrder}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
            min={0}
          />
        </div>
      </form>
    </Modal>
  );
}
