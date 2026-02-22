"use client";

import { useState, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import {
  Wand2,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  BarChart3,
} from "lucide-react";
import type { ScheduleGenerationResult } from "@/types/scheduling";

interface GenerateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: string;
  year: number;
  month: number;
  onApply: (result: ScheduleGenerationResult) => void;
}

export default function GenerateScheduleModal({
  isOpen,
  onClose,
  scheduleId,
  year,
  month,
  onApply,
}: GenerateScheduleModalProps) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ScheduleGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 설정
  const [minD, setMinD] = useState(3);
  const [minE, setMinE] = useState(3);
  const [minN, setMinN] = useState(2);
  const [maxConsecutive, setMaxConsecutive] = useState(5);
  const [maxNight, setMaxNight] = useState(3);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/schedules/${scheduleId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minStaff: { D: minD, E: minE, N: minN },
          maxConsecutiveWork: maxConsecutive,
          maxConsecutiveNight: maxNight,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "생성 실패");
        return;
      }

      const data: ScheduleGenerationResult = await res.json();
      setResult(data);
    } catch {
      setError("스케줄 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  }, [scheduleId, minD, minE, minN, maxConsecutive, maxNight]);

  const handleApply = useCallback(() => {
    if (result) {
      onApply(result);
      onClose();
    }
  }, [result, onApply, onClose]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`AI 근무표 생성 - ${year}년 ${month}월`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          {result && (
            <Button onClick={handleApply}>
              <CheckCircle className="mr-1 h-4 w-4" />
              적용
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* 설정 패널 */}
        {!result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                최소 인원 배치 (RN 기준)
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "D (주간)", value: minD, set: setMinD },
                  { label: "E (저녁)", value: minE, set: setMinE },
                  { label: "N (야간)", value: minN, set: setMinN },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      {label}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={value}
                      onChange={(e) => set(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                연속 근무 제한
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    최대 연속 근무 (일)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={7}
                    value={maxConsecutive}
                    onChange={(e) => setMaxConsecutive(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    최대 연속 야간 (일)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={maxNight}
                    onChange={(e) => setMaxNight(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              loading={generating}
              className="w-full"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {generating ? "생성 중..." : "AI 근무표 생성"}
            </Button>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* 결과 표시 */}
        {result && (
          <div className="space-y-4">
            {/* 점수 브레이크다운 */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <BarChart3 className="h-4 w-4" />
                생성 결과
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">희망 반영</span>
                  <span className="font-medium">
                    {result.score.preferenceScore.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">야간 공정성</span>
                  <span className="font-medium">
                    {result.score.nightFairnessScore.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">주말 공정성</span>
                  <span className="font-medium">
                    {result.score.weekendFairnessScore.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">연속근무</span>
                  <span className="font-medium">
                    {result.score.consecutivePenalty.toFixed(1)}
                  </span>
                </div>
                <div className="col-span-2 mt-1 flex justify-between border-t border-slate-200 pt-1 dark:border-slate-700">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    총점
                  </span>
                  <span className="font-bold text-blue-600">
                    {result.score.total.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* 메타데이터 */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>반복: {result.metadata.iterations}회</span>
              {result.metadata.earlyStop && <span>(조기 종료)</span>}
              <span>
                Hard: {result.metadata.hardViolations} / Soft:{" "}
                {result.metadata.softViolations}
              </span>
            </div>

            {/* 위반 사항 */}
            {result.violations.length > 0 && (
              <div className="max-h-[200px] space-y-1 overflow-y-auto">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  위반 사항 ({result.violations.length}건)
                </h4>
                {result.violations
                  .sort((a, _b) => (a.type === "HARD" ? -1 : 1))
                  .slice(0, 20)
                  .map((v, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded px-2 py-1 text-xs ${
                        v.type === "HARD"
                          ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                          : "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                      }`}
                    >
                      {v.type === "HARD" ? (
                        <AlertOctagon className="mt-0.5 h-3 w-3 shrink-0" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      )}
                      <span>{v.message}</span>
                    </div>
                  ))}
                {result.violations.length > 20 && (
                  <p className="text-xs text-slate-400">
                    ... 외 {result.violations.length - 20}건
                  </p>
                )}
              </div>
            )}

            {/* 간호사별 요약 */}
            <div className="max-h-[200px] overflow-y-auto">
              <h4 className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                간호사별 요약
              </h4>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-1 py-1 text-left">이름</th>
                    <th className="px-1 py-1 text-center">D</th>
                    <th className="px-1 py-1 text-center">E</th>
                    <th className="px-1 py-1 text-center">N</th>
                    <th className="px-1 py-1 text-center">O/X</th>
                    <th className="px-1 py-1 text-center">주말</th>
                    <th className="px-1 py-1 text-center">연속</th>
                  </tr>
                </thead>
                <tbody>
                  {result.nurseSummaries
                    .filter((s) => s.position !== "HN" && s.position !== "CN")
                    .map((s) => (
                      <tr
                        key={s.nurseId}
                        className="border-b border-slate-100 dark:border-slate-700/50"
                      >
                        <td className="px-1 py-0.5 font-medium">{s.nurseName}</td>
                        <td className="px-1 py-0.5 text-center">{s.counts.D}</td>
                        <td className="px-1 py-0.5 text-center">{s.counts.E}</td>
                        <td className="px-1 py-0.5 text-center">{s.counts.N}</td>
                        <td className="px-1 py-0.5 text-center">
                          {(s.counts.O || 0) + (s.counts.X || 0)}
                        </td>
                        <td className="px-1 py-0.5 text-center">
                          {s.weekendWorkDays}
                        </td>
                        <td className="px-1 py-0.5 text-center">
                          {s.maxConsecutive}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* 다시 생성 / 적용 */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="flex-1"
              >
                다시 생성
              </Button>
              <Button size="sm" onClick={handleApply} className="flex-1">
                <CheckCircle className="mr-1 h-4 w-4" />
                그리드에 적용
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
