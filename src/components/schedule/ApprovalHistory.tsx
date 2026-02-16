"use client";

import { memo } from "react";
import { ROLE_LABELS } from "@/lib/utils";

interface ApprovalRecord {
  id: string;
  approvalStep: number;
  approvalRole: string;
  action: string;
  comment: string | null;
  actedAt: string | Date;
  approver: {
    id: string;
    name: string;
  };
}

interface ApprovalHistoryProps {
  approvals: ApprovalRecord[];
}

const ACTION_LABELS: Record<string, string> = {
  SUBMIT: "제출",
  APPROVE: "승인",
  REJECT: "반려",
};

const ACTION_COLORS: Record<string, string> = {
  SUBMIT: "bg-blue-500",
  APPROVE: "bg-green-500",
  REJECT: "bg-red-500",
};

const ACTION_TEXT_COLORS: Record<string, string> = {
  SUBMIT: "text-blue-700",
  APPROVE: "text-green-700",
  REJECT: "text-red-700",
};

const ACTION_BG_LIGHT: Record<string, string> = {
  SUBMIT: "bg-blue-50 border-blue-200",
  APPROVE: "bg-green-50 border-green-200",
  REJECT: "bg-red-50 border-red-200",
};

function ApprovalHistoryInner({ approvals }: ApprovalHistoryProps) {
  if (approvals.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        승인 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {approvals.map((approval, idx) => {
        const isLast = idx === approvals.length - 1;
        const dotColor = ACTION_COLORS[approval.action] || "bg-gray-400";
        const textColor = ACTION_TEXT_COLORS[approval.action] || "text-gray-700";
        const bgLight = ACTION_BG_LIGHT[approval.action] || "bg-gray-50 border-gray-200";

        return (
          <div key={approval.id} className="relative flex gap-4">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={`h-3 w-3 rounded-full ${dotColor} mt-1.5 shrink-0 ring-2 ring-white`}
              />
              {!isLast && (
                <div className="w-0.5 flex-1 bg-gray-200" />
              )}
            </div>

            {/* Content */}
            <div className={`mb-4 flex-1 rounded-lg border p-3 ${bgLight}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm font-semibold ${textColor}`}>
                  {ACTION_LABELS[approval.action] || approval.action}
                </span>
                <span className="text-xs text-gray-500">
                  (단계 {approval.approvalStep})
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span className="font-medium">{approval.approver.name}</span>
                <span className="text-gray-400">|</span>
                <span>
                  {ROLE_LABELS[approval.approvalRole] || approval.approvalRole}
                </span>
                <span className="text-gray-400">|</span>
                <span>
                  {new Date(approval.actedAt).toLocaleString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {approval.comment && (
                <p className="mt-2 text-xs text-gray-700 bg-white/60 rounded px-2 py-1">
                  {approval.comment}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ApprovalHistory = memo(ApprovalHistoryInner);
ApprovalHistory.displayName = "ApprovalHistory";

export default ApprovalHistory;
