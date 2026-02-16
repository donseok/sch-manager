"use client";

import { useState, useEffect } from "react";
import { SHIFT_COLORS } from "@/lib/utils";

interface ChangeLog {
  id: string;
  scheduleId: string;
  nurseId: string;
  workDate: string;
  previousShiftCode: string | null;
  newShiftCode: string;
  changeReason: string | null;
  changedById: string;
  versionBefore: number;
  versionAfter: number;
  changedAt: string;
  nurse: {
    id: string;
    name: string;
  };
  changedBy: {
    id: string;
    name: string;
  };
}

interface ChangeHistoryProps {
  scheduleId: string;
}

function ShiftBadge({ code }: { code: string | null }) {
  if (!code) {
    return <span className="text-sm text-slate-400">-</span>;
  }
  const colorClass = SHIFT_COLORS[code] || "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold ${colorClass}`}
    >
      {code}
    </span>
  );
}

export default function ChangeHistory({ scheduleId }: ChangeHistoryProps) {
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      try {
        const res = await fetch(`/api/schedules/${scheduleId}/history`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (error) {
        console.error("Failed to fetch change history:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [scheduleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-8 text-center text-base text-slate-400">
        변경 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-base">
        <thead>
          <tr className="border-b border-slate-200 text-left dark:border-slate-700">
            <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
              날짜
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
              간호사
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
              변경전
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
              변경후
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
              사유
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
              변경자
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
              변경일시
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-b border-slate-100 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-700/50"
            >
              <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400">
                {new Date(log.workDate).toLocaleDateString("ko-KR", {
                  month: "2-digit",
                  day: "2-digit",
                })}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                {log.nurse.name}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <ShiftBadge code={log.previousShiftCode} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <ShiftBadge code={log.newShiftCode} />
              </td>
              <td className="max-w-[200px] truncate px-3 py-2 text-slate-600 dark:text-slate-400">
                {log.changeReason || "-"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400">
                {log.changedBy.name}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-500">
                {new Date(log.changedAt).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
