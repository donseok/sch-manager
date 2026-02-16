export function cn(...inputs: (string | undefined)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getDayOfWeek(year: number, month: number, day: number): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[new Date(year, month - 1, day).getDay()];
}

export function getDayOfWeekIndex(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export const SHIFT_COLORS: Record<string, string> = {
  D: "bg-yellow-100 text-yellow-800",
  E: "bg-blue-100 text-blue-800",
  N: "bg-purple-100 text-purple-800",
  O: "bg-green-100 text-green-800",
  X: "bg-gray-100 text-gray-600",
  T: "bg-orange-100 text-orange-800",
  B: "bg-pink-100 text-pink-800",
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "작성중",
  PENDING_MANAGER: "간호과장 승인대기",
  PENDING_DIRECTOR: "간호부장 승인대기",
  APPROVED: "승인완료",
  CONFIRMED: "확정",
  REVISED: "수정됨",
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_MANAGER: "bg-yellow-100 text-yellow-700",
  PENDING_DIRECTOR: "bg-orange-100 text-orange-700",
  APPROVED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-green-100 text-green-700",
  REVISED: "bg-red-100 text-red-700",
};

export const ROLE_LABELS: Record<string, string> = {
  HEAD_NURSE: "수간호사",
  NURSING_MANAGER: "간호과장",
  NURSING_DIRECTOR: "간호부장",
  ADMIN: "관리자",
};

export const POSITION_LABELS: Record<string, string> = {
  HN: "수간호사",
  CN: "책임간호사",
  AN: "주임간호사",
  RN: "일반간호사",
};
