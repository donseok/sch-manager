import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Users,
  CalendarDays,
  AlertTriangle,
  BarChart3,
  Clock,
  Sun,
  Sunset,
  Moon,
  Calendar,
  UserCheck,
  Bell,
  Shield,
  Activity,
  ChevronRight,
  Info,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import {
  getDaysInMonth,
  getDayOfWeek,
  getDayOfWeekIndex,
  POSITION_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/utils";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const WORKING_SHIFTS = ["D", "E", "N", "T"];

async function getDashboardData() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.getDate();
  const todayDow = now.getDay();
  const daysInMonth = getDaysInMonth(year, month);

  // Get primary ward
  const ward = await prisma.ward.findFirst({ where: { isActive: true } });
  if (!ward) return null;

  // Parallel queries
  const [schedule, allNurses, recentChanges] = await Promise.all([
    // Current month CONFIRMED schedule with all entries
    prisma.schedule.findFirst({
      where: { wardId: ward.id, year, month, status: "CONFIRMED" },
      orderBy: { version: "desc" },
      include: {
        entries: {
          include: {
            nurse: {
              select: { name: true, position: true, employeeNumber: true },
            },
          },
        },
      },
    }),
    // All nurses for this ward (any status)
    prisma.nurse.findMany({
      where: { wardId: ward.id },
      orderBy: { sortOrder: "asc" },
    }),
    // Recent 10 change logs
    prisma.scheduleChangeLog.findMany({
      take: 10,
      include: {
        nurse: { select: { name: true } },
        changedBy: { select: { name: true } },
        schedule: {
          select: {
            year: true,
            month: true,
            ward: { select: { wardName: true } },
          },
        },
      },
      orderBy: { changedAt: "desc" },
    }),
  ]);

  // Build entry map: nurseId -> Map<day, shiftCode>
  const entryMap = new Map<string, Map<number, string>>();
  const nurseInfoMap = new Map<
    string,
    { name: string; position: string; employeeNumber: string }
  >();

  if (schedule) {
    for (const entry of schedule.entries) {
      const day = new Date(entry.workDate).getDate();
      if (!entryMap.has(entry.nurseId)) {
        entryMap.set(entry.nurseId, new Map());
        nurseInfoMap.set(entry.nurseId, {
          name: entry.nurse.name,
          position: entry.nurse.position,
          employeeNumber: entry.nurse.employeeNumber,
        });
      }
      entryMap.get(entry.nurseId)!.set(day, entry.shiftTypeCode);
    }
  }

  // ── 1. Today's shifts ──
  const todayShifts: Record<string, string[]> = {
    D: [],
    E: [],
    N: [],
    O: [],
    X: [],
    T: [],
  };
  for (const [nurseId, days] of entryMap) {
    const shift = days.get(today);
    if (shift && shift in todayShifts) {
      todayShifts[shift].push(nurseInfoMap.get(nurseId)!.name);
    }
  }

  // ── 2. Monthly progress ──
  const activeNurses = allNurses.filter(
    (n) => n.employmentStatus === "ACTIVE"
  );
  const totalCells = activeNurses.length * daysInMonth;
  let filledCells = 0;
  for (const [, days] of entryMap) {
    filledCells += days.size;
  }

  // ── 3. Fairness metrics ──
  const fairnessData: {
    name: string;
    position: string;
    nightCount: number;
    weekendCount: number;
    totalWorkDays: number;
    maxConsecutive: number;
    totalHours: number;
  }[] = [];

  for (const [nurseId, days] of entryMap) {
    const info = nurseInfoMap.get(nurseId)!;
    let nightCount = 0;
    let weekendCount = 0;
    let totalWorkDays = 0;
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const shift = days.get(day) || "";
      const dow = getDayOfWeekIndex(year, month, day);
      const isWeekend = dow === 0 || dow === 6;
      const isWorking = WORKING_SHIFTS.includes(shift);

      if (shift === "N") nightCount++;
      if (isWeekend && isWorking) weekendCount++;
      if (isWorking) totalWorkDays++;

      if (isWorking) {
        currentConsecutive++;
        if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
      } else {
        currentConsecutive = 0;
      }
    }

    fairnessData.push({
      name: info.name,
      position: info.position,
      nightCount,
      weekendCount,
      totalWorkDays,
      maxConsecutive,
      totalHours: totalWorkDays * 8,
    });
  }

  const avgNight =
    fairnessData.length > 0
      ? fairnessData.reduce((s, d) => s + d.nightCount, 0) /
      fairnessData.length
      : 0;
  const avgWeekend =
    fairnessData.length > 0
      ? fairnessData.reduce((s, d) => s + d.weekendCount, 0) /
      fairnessData.length
      : 0;
  const avgWorkDays =
    fairnessData.length > 0
      ? fairnessData.reduce((s, d) => s + d.totalWorkDays, 0) /
      fairnessData.length
      : 0;
  const avgConsecutive =
    fairnessData.length > 0
      ? fairnessData.reduce((s, d) => s + d.maxConsecutive, 0) /
      fairnessData.length
      : 0;
  const avgHours =
    fairnessData.length > 0
      ? fairnessData.reduce((s, d) => s + d.totalHours, 0) /
      fairnessData.length
      : 0;

  // Fairness outlier alerts
  const fairnessAlerts: string[] = [];
  for (const nurse of fairnessData) {
    const nightDiff = nurse.nightCount - avgNight;
    if (nightDiff >= 2) {
      fairnessAlerts.push(
        `${nurse.name} 야간 ${nurse.nightCount}회 — 평균 대비 +${Math.round(nightDiff)}회`
      );
    }
    const weekendDiff = nurse.weekendCount - avgWeekend;
    if (weekendDiff >= 2) {
      fairnessAlerts.push(
        `${nurse.name} 주말 ${nurse.weekendCount}회 — 평균 대비 +${Math.round(weekendDiff)}회`
      );
    }
  }

  // ── 4. Staff stats ──
  const byPosition = [
    {
      position: "HN",
      label: POSITION_LABELS.HN,
      count: activeNurses.filter((n) => n.position === "HN").length,
      color: "bg-rose-500",
    },
    {
      position: "CN",
      label: POSITION_LABELS.CN,
      count: activeNurses.filter((n) => n.position === "CN").length,
      color: "bg-amber-500",
    },
    {
      position: "AN",
      label: POSITION_LABELS.AN,
      count: activeNurses.filter((n) => n.position === "AN").length,
      color: "bg-blue-500",
    },
    {
      position: "RN",
      label: POSITION_LABELS.RN,
      count: activeNurses.filter((n) => n.position === "RN").length,
      color: "bg-emerald-500",
    },
  ];

  // ── 5. Week preview ──
  const weekPreview: {
    date: number;
    dayLabel: string;
    dayIndex: number;
    D: number;
    E: number;
    N: number;
    total: number;
  }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = today + i;
    if (d > daysInMonth) break;

    const dow = getDayOfWeekIndex(year, month, d);
    let dCount = 0;
    let eCount = 0;
    let nCount = 0;
    let total = 0;

    for (const [, days] of entryMap) {
      const shift = days.get(d);
      if (shift === "D") dCount++;
      if (shift === "E") eCount++;
      if (shift === "N") nCount++;
      if (shift && WORKING_SHIFTS.includes(shift)) total++;
    }

    weekPreview.push({
      date: d,
      dayLabel: getDayOfWeek(year, month, d),
      dayIndex: dow,
      D: dCount,
      E: eCount,
      N: nCount,
      total,
    });
  }

  // ── 7. Alerts ──
  const alerts: { type: "warning" | "danger" | "info"; message: string }[] =
    [];

  for (const [nurseId, days] of entryMap) {
    const info = nurseInfoMap.get(nurseId)!;

    // Consecutive working days >= 5
    let consecutive = 0;
    let startDay = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const shift = days.get(day);
      if (shift && WORKING_SHIFTS.includes(shift)) {
        if (consecutive === 0) startDay = day;
        consecutive++;
      } else {
        if (consecutive >= 5) {
          alerts.push({
            type: "warning",
            message: `${info.name}: ${startDay}일~${startDay + consecutive - 1}일 연속 ${consecutive}일 근무`,
          });
        }
        consecutive = 0;
      }
    }
    if (consecutive >= 5) {
      alerts.push({
        type: "warning",
        message: `${info.name}: ${startDay}일~${startDay + consecutive - 1}일 연속 ${consecutive}일 근무`,
      });
    }

    // N→D violation (night then day next day)
    for (let day = 1; day < daysInMonth; day++) {
      if (days.get(day) === "N" && days.get(day + 1) === "D") {
        alerts.push({
          type: "danger",
          message: `${info.name}: ${day}일(N) → ${day + 1}일(D) 야간 후 주간 금칙 위반`,
        });
      }
    }
  }

  // Next month schedule deadline
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextSchedule = await prisma.schedule.findFirst({
    where: { wardId: ward.id, year: nextYear, month: nextMonth },
  });
  if (!nextSchedule) {
    const daysLeft = daysInMonth - today;
    if (daysLeft >= 0) {
      alerts.push({
        type: "info",
        message: `${nextYear}년 ${nextMonth}월 근무표 미작성 (D-${daysLeft})`,
      });
    }
  }

  // Add fairness alerts
  for (const msg of fairnessAlerts) {
    alerts.push({ type: "warning", message: msg });
  }

  return {
    ward,
    year,
    month,
    today,
    todayDow,
    daysInMonth,
    schedule,
    todayShifts,
    totalCells,
    filledCells,
    fairnessData,
    avgNight,
    avgWeekend,
    avgWorkDays,
    avgConsecutive,
    avgHours,
    weekPreview,
    alerts,
    recentChanges,
    activeCount: activeNurses.length,
    inactiveCount: allNurses.length - activeNurses.length,
    byPosition,
  };
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400">
        <p>병동 정보가 없습니다.</p>
      </div>
    );
  }

  const progressPercent =
    data.totalCells > 0
      ? Math.round((data.filledCells / data.totalCells) * 100)
      : 0;

  // Sort fairness data for charts
  const nightSorted = [...data.fairnessData].sort(
    (a, b) => b.nightCount - a.nightCount
  );
  const weekendSorted = [...data.fairnessData].sort(
    (a, b) => b.weekendCount - a.weekendCount
  );
  const workDaysSorted = [...data.fairnessData].sort(
    (a, b) => b.totalWorkDays - a.totalWorkDays
  );

  const maxNight = Math.max(
    ...data.fairnessData.map((d) => d.nightCount),
    1
  );
  const maxWeekend = Math.max(
    ...data.fairnessData.map((d) => d.weekendCount),
    1
  );
  const maxWorkDays = Math.max(
    ...data.fairnessData.map((d) => d.totalWorkDays),
    1
  );
  const consecutiveSorted = [...data.fairnessData].sort(
    (a, b) => b.maxConsecutive - a.maxConsecutive
  );
  const maxConsecutive = Math.max(
    ...data.fairnessData.map((d) => d.maxConsecutive),
    1
  );
  const maxPosition = Math.max(...data.byPosition.map((p) => p.count), 1);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          근무표 관리 대시보드
        </h1>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          {data.ward.wardName} · {data.year}년 {data.month}월 {data.today}일 (
          {DAY_LABELS[data.todayDow]})
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Active nurses */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                재직 간호사
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
                {data.activeCount}
                <span className="text-base font-normal text-slate-400">명</span>
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Schedule status */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                금월 근무표
              </p>
              <div className="mt-2">
                {data.schedule ? (
                  <Badge
                    className={STATUS_COLORS[data.schedule.status] || ""}
                  >
                    {STATUS_LABELS[data.schedule.status] ||
                      data.schedule.status}
                  </Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-600">
                    미작성
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/30">
              <CalendarDays className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Empty cells */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                미배정 셀
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
                {data.totalCells - data.filledCells}
                <span className="text-base font-normal text-slate-400">개</span>
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/30">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                작성 진행률
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
                {progressPercent}
                <span className="text-base font-normal text-slate-400">%</span>
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30">
              <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 1. Today's Shifts ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <Clock className="h-5 w-5 text-blue-500" />
            금일 근무 현황
            <span className="text-base font-normal text-slate-500 dark:text-slate-400">
              ({data.month}월 {data.today}일 {DAY_LABELS[data.todayDow]}요일)
            </span>
          </h3>
        </div>
        <div className="p-6">
          {data.schedule ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {/* D 주간 */}
              <ShiftCard
                icon={<Sun className="h-4 w-4 text-yellow-600" />}
                label="D 주간"
                count={data.todayShifts.D.length}
                names={data.todayShifts.D}
                borderColor="border-yellow-200 dark:border-yellow-900/50"
                bgColor="bg-yellow-50 dark:bg-yellow-900/20"
                textColor="text-yellow-800 dark:text-yellow-300"
                nameColor="text-yellow-700 dark:text-yellow-400"
                countColor="text-yellow-700 dark:text-yellow-300"
              />
              {/* E 저녁 */}
              <ShiftCard
                icon={<Sunset className="h-4 w-4 text-blue-600" />}
                label="E 저녁"
                count={data.todayShifts.E.length}
                names={data.todayShifts.E}
                borderColor="border-blue-200 dark:border-blue-900/50"
                bgColor="bg-blue-50 dark:bg-blue-900/20"
                textColor="text-blue-800 dark:text-blue-300"
                nameColor="text-blue-700 dark:text-blue-400"
                countColor="text-blue-700 dark:text-blue-300"
              />
              {/* N 야간 */}
              <ShiftCard
                icon={<Moon className="h-4 w-4 text-purple-600" />}
                label="N 야간"
                count={data.todayShifts.N.length}
                names={data.todayShifts.N}
                borderColor="border-purple-200 dark:border-purple-900/50"
                bgColor="bg-purple-50 dark:bg-purple-900/20"
                textColor="text-purple-800 dark:text-purple-300"
                nameColor="text-purple-700 dark:text-purple-400"
                countColor="text-purple-700 dark:text-purple-300"
              />
              {/* O 공휴 */}
              <ShiftCard
                icon={<Calendar className="h-4 w-4 text-green-600" />}
                label="O 공휴"
                count={data.todayShifts.O.length}
                names={data.todayShifts.O}
                borderColor="border-green-200 dark:border-green-900/50"
                bgColor="bg-green-50 dark:bg-green-900/20"
                textColor="text-green-800 dark:text-green-300"
                nameColor="text-green-700 dark:text-green-400"
                countColor="text-green-700 dark:text-green-300"
              />
              {/* X 휴무 */}
              <ShiftCard
                icon={<CalendarDays className="h-4 w-4 text-slate-500" />}
                label="X 휴무"
                count={data.todayShifts.X.length}
                names={data.todayShifts.X}
                borderColor="border-slate-200 dark:border-slate-600"
                bgColor="bg-slate-50 dark:bg-slate-700/50"
                textColor="text-slate-700 dark:text-slate-300"
                nameColor="text-slate-600 dark:text-slate-400"
                countColor="text-slate-600 dark:text-slate-300"
              />
            </div>
          ) : (
            <EmptyState
              icon={<Clock className="h-10 w-10" />}
              message="금월 근무표가 아직 작성되지 않았습니다."
            />
          )}
        </div>
      </div>

      {/* ── 5. Week Preview ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <Calendar className="h-5 w-5 text-indigo-500" />
            이번 주 일정 미리보기
          </h3>
        </div>
        <div className="p-6">
          {data.weekPreview.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left text-sm font-medium text-slate-500 dark:text-slate-400">
                      구분
                    </th>
                    {data.weekPreview.map((day) => (
                      <th
                        key={day.date}
                        className={`px-3 py-2 text-center text-sm font-medium ${day.date === data.today
                          ? "rounded-t-lg bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : day.dayIndex === 0
                            ? "text-red-500"
                            : day.dayIndex === 6
                              ? "text-blue-500"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                      >
                        <div>{day.date}일</div>
                        <div className="text-[11px]">{day.dayLabel}</div>
                        {day.date === data.today && (
                          <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                            TODAY
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* D */}
                  <tr>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1 rounded bg-yellow-100 px-1.5 py-0.5 text-sm font-semibold text-yellow-800">
                        <Sun className="h-3 w-3" /> D
                      </span>
                    </td>
                    {data.weekPreview.map((day) => (
                      <td
                        key={`d-${day.date}`}
                        className={`px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-300 ${day.date === data.today
                          ? "bg-blue-50/50 dark:bg-blue-900/10"
                          : ""
                          }`}
                      >
                        {day.D}
                      </td>
                    ))}
                  </tr>
                  {/* E */}
                  <tr>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-sm font-semibold text-blue-800">
                        <Sunset className="h-3 w-3" /> E
                      </span>
                    </td>
                    {data.weekPreview.map((day) => (
                      <td
                        key={`e-${day.date}`}
                        className={`px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-300 ${day.date === data.today
                          ? "bg-blue-50/50 dark:bg-blue-900/10"
                          : ""
                          }`}
                      >
                        {day.E}
                      </td>
                    ))}
                  </tr>
                  {/* N */}
                  <tr>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-sm font-semibold text-purple-800">
                        <Moon className="h-3 w-3" /> N
                      </span>
                    </td>
                    {data.weekPreview.map((day) => (
                      <td
                        key={`n-${day.date}`}
                        className={`px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-300 ${day.date === data.today
                          ? "bg-blue-50/50 dark:bg-blue-900/10"
                          : ""
                          }`}
                      >
                        {day.N}
                      </td>
                    ))}
                  </tr>
                  {/* Total row */}
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-2 py-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      총 투입
                    </td>
                    {data.weekPreview.map((day) => (
                      <td
                        key={`t-${day.date}`}
                        className={`px-3 py-2 text-center text-base font-bold text-slate-900 dark:text-slate-100 ${day.date === data.today
                          ? "bg-blue-50/50 dark:bg-blue-900/10"
                          : ""
                          }`}
                      >
                        {day.total}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<Calendar className="h-10 w-10" />}
              message="주간 일정 데이터가 없습니다."
            />
          )}
        </div>
      </div>

      {/* ── 3. Fairness Metrics ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
            근무 공정성 지표
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            평균 야간: {data.avgNight.toFixed(1)}회 · 주말:{" "}
            {data.avgWeekend.toFixed(1)}회 · 연속:{" "}
            {data.avgConsecutive.toFixed(1)}일 · 총시간:{" "}
            {data.avgHours.toFixed(0)}h
          </p>
        </div>
        <div className="p-6">
          {data.fairnessData.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
                {/* Night shifts */}
                <FairnessChart
                  title="야간(N) 횟수"
                  icon={<Moon className="h-4 w-4" />}
                  titleColor="text-purple-700 dark:text-purple-400"
                  barColor="bg-purple-400"
                  warnColor="bg-red-400"
                  data={nightSorted}
                  valueKey="nightCount"
                  max={maxNight}
                  avg={data.avgNight}
                />
                {/* Weekend shifts */}
                <FairnessChart
                  title="주말 근무 횟수"
                  icon={<Calendar className="h-4 w-4" />}
                  titleColor="text-blue-700 dark:text-blue-400"
                  barColor="bg-blue-400"
                  warnColor="bg-red-400"
                  data={weekendSorted}
                  valueKey="weekendCount"
                  max={maxWeekend}
                  avg={data.avgWeekend}
                />
                {/* Consecutive */}
                <FairnessChart
                  title="최대 연속 근무"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  titleColor="text-orange-700 dark:text-orange-400"
                  barColor="bg-orange-400"
                  warnColor="bg-red-400"
                  data={consecutiveSorted}
                  valueKey="maxConsecutive"
                  max={maxConsecutive}
                  avg={data.avgConsecutive}
                />
                {/* Total work days */}
                <FairnessChart
                  title="총 근무일수"
                  icon={<Activity className="h-4 w-4" />}
                  titleColor="text-emerald-700 dark:text-emerald-400"
                  barColor="bg-emerald-400"
                  warnColor="bg-emerald-400"
                  data={workDaysSorted}
                  valueKey="totalWorkDays"
                  max={maxWorkDays}
                  avg={data.avgWorkDays}
                />
              </div>

              {/* Fairness comparison table */}
              <div className="mt-8">
                <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  사원별 상세 비교
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-2 py-2 text-left font-medium text-slate-500 dark:text-slate-400">사원명</th>
                        <th className="px-2 py-2 text-left font-medium text-slate-500 dark:text-slate-400">직위</th>
                        <th className="px-2 py-2 text-center font-medium text-purple-600 dark:text-purple-400">야간(N)</th>
                        <th className="px-2 py-2 text-center font-medium text-blue-600 dark:text-blue-400">주말</th>
                        <th className="px-2 py-2 text-center font-medium text-orange-600 dark:text-orange-400">연속</th>
                        <th className="px-2 py-2 text-center font-medium text-emerald-600 dark:text-emerald-400">근무일</th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 dark:text-slate-400">시간(h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.fairnessData
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((nurse) => {
                          const nDiff = nurse.nightCount - data.avgNight;
                          const wDiff = nurse.weekendCount - data.avgWeekend;
                          return (
                            <tr key={nurse.name} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                              <td className="px-2 py-2 font-medium text-slate-900 dark:text-slate-100">{nurse.name}</td>
                              <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{POSITION_LABELS[nurse.position] || nurse.position}</td>
                              <td className={`px-2 py-2 text-center font-semibold ${nDiff >= 2 ? "text-red-600 dark:text-red-400" : nDiff <= -2 ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>
                                {nurse.nightCount}
                                {Math.abs(nDiff) >= 1.5 && (
                                  <span className="ml-1 text-[10px] font-normal">({nDiff > 0 ? "+" : ""}{nDiff.toFixed(1)})</span>
                                )}
                              </td>
                              <td className={`px-2 py-2 text-center font-semibold ${wDiff >= 2 ? "text-red-600 dark:text-red-400" : wDiff <= -2 ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>
                                {nurse.weekendCount}
                                {Math.abs(wDiff) >= 1.5 && (
                                  <span className="ml-1 text-[10px] font-normal">({wDiff > 0 ? "+" : ""}{wDiff.toFixed(1)})</span>
                                )}
                              </td>
                              <td className={`px-2 py-2 text-center font-semibold ${nurse.maxConsecutive >= 5 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}`}>
                                {nurse.maxConsecutive}
                                {nurse.maxConsecutive >= 5 && <span className="ml-1 text-[10px] text-red-500">⚠</span>}
                              </td>
                              <td className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">{nurse.totalWorkDays}</td>
                              <td className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">{nurse.totalHours}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
                        <td colSpan={2} className="px-2 py-2 font-semibold text-slate-600 dark:text-slate-400">평균</td>
                        <td className="px-2 py-2 text-center font-semibold text-purple-600 dark:text-purple-400">{data.avgNight.toFixed(1)}</td>
                        <td className="px-2 py-2 text-center font-semibold text-blue-600 dark:text-blue-400">{data.avgWeekend.toFixed(1)}</td>
                        <td className="px-2 py-2 text-center font-semibold text-orange-600 dark:text-orange-400">{data.avgConsecutive.toFixed(1)}</td>
                        <td className="px-2 py-2 text-center font-semibold text-emerald-600 dark:text-emerald-400">{data.avgWorkDays.toFixed(1)}</td>
                        <td className="px-2 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">{data.avgHours.toFixed(0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={<BarChart3 className="h-10 w-10" />}
              message="공정성 분석 데이터가 없습니다."
            />
          )}
        </div>
      </div>

      {/* ── 4 & 7. Staff Stats + Alerts ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Staff stats */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <UserCheck className="h-5 w-5 text-teal-500" />
              인력 통계
            </h3>
          </div>
          <div className="p-6">
            <div className="mb-5 flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {data.activeCount}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  재직
                </p>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-400">
                  {data.inactiveCount}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  비재직
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {data.byPosition.map((pos) => (
                <div key={pos.position} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-slate-600 dark:text-slate-400">
                    {pos.label}
                  </span>
                  <div className="flex-1 h-5 rounded bg-slate-100 dark:bg-slate-700">
                    <div
                      className={`flex h-5 items-center rounded pl-2 ${pos.color} transition-all`}
                      style={{
                        width: `${(pos.count / maxPosition) * 100}%`,
                        minWidth: pos.count > 0 ? "24px" : "0",
                      }}
                    >
                      <span className="text-[11px] font-bold text-white">
                        {pos.count}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <Bell className="h-5 w-5 text-orange-500" />
              알림 / 주의사항
              {data.alerts.length > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-sm font-semibold text-red-700">
                  {data.alerts.length}
                </span>
              )}
            </h3>
          </div>
          <div className="p-6">
            {data.alerts.length > 0 ? (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {data.alerts.map((alert, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${alert.type === "danger"
                      ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                      : alert.type === "warning"
                        ? "bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300"
                        : "bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                      }`}
                  >
                    {alert.type === "danger" ? (
                      <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : alert.type === "warning" ? (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    {alert.message}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Shield className="h-10 w-10" />}
                message="알림이 없습니다."
              />
            )}
          </div>
        </div>
      </div>

      {/* ── 6. Recent Changes ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <Activity className="h-5 w-5 text-blue-500" />
            최근 변경 이력
          </h3>
        </div>
        <div className="p-6">
          {data.recentChanges.length > 0 ? (
            <ul className="space-y-3">
              {data.recentChanges.map((change) => (
                <li
                  key={change.id}
                  className="flex items-start gap-3 text-base text-slate-700 dark:text-slate-300"
                >
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {change.nurse.name}
                    </span>
                    의 {change.schedule.year}년 {change.schedule.month}월 근무
                    변경 —{" "}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {change.changedBy.name}
                    </span>
                    <span className="ml-2 text-sm text-slate-400 dark:text-slate-500">
                      {formatTimeAgo(new Date(change.changedAt))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Activity className="h-10 w-10" />}
              message="최근 변경 내역이 없습니다."
            />
          )}
        </div>
      </div>

      {/* Footer link */}
      <div className="flex justify-center pb-4">
        <Link
          href="/schedules"
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-base font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          근무표 관리로 이동
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function ShiftCard({
  icon,
  label,
  count,
  names,
  borderColor,
  bgColor,
  textColor,
  nameColor,
  countColor,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  names: string[];
  borderColor: string;
  bgColor: string;
  textColor: string;
  nameColor: string;
  countColor: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${borderColor} ${bgColor}`}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className={`text-base font-semibold ${textColor}`}>{label}</span>
        <span className={`ml-auto text-xl font-bold ${countColor}`}>
          {count}
        </span>
      </div>
      <div className="space-y-0.5">
        {names.length > 0 ? (
          names.map((name, i) => (
            <p key={i} className={`text-sm ${nameColor}`}>
              {name}
            </p>
          ))
        ) : (
          <p className={`text-sm opacity-50 ${nameColor}`}>-</p>
        )}
      </div>
    </div>
  );
}

function FairnessChart({
  title,
  icon,
  titleColor,
  barColor,
  warnColor,
  data,
  valueKey,
  max,
  avg,
}: {
  title: string;
  icon: React.ReactNode;
  titleColor: string;
  barColor: string;
  warnColor: string;
  data: { name: string; nightCount: number; weekendCount: number; totalWorkDays: number; maxConsecutive: number; totalHours: number }[];
  valueKey: "nightCount" | "weekendCount" | "totalWorkDays" | "maxConsecutive";
  max: number;
  avg: number;
}) {
  return (
    <div>
      <h4
        className={`mb-3 flex items-center gap-1.5 text-base font-semibold ${titleColor}`}
      >
        {icon} {title}
      </h4>
      <div className="space-y-1.5">
        {data.map((nurse) => {
          const value = nurse[valueKey];
          const isOver = value > avg + 1.5;
          return (
            <div key={nurse.name} className="flex items-center gap-2">
              <span className="w-16 truncate text-right text-sm text-slate-600 dark:text-slate-400">
                {nurse.name}
              </span>
              <div className="h-4 flex-1 rounded bg-slate-100 dark:bg-slate-700">
                <div
                  className={`h-4 rounded transition-all ${isOver ? warnColor : barColor}`}
                  style={{
                    width: `${(value / max) * 100}%`,
                    minWidth: value > 0 ? "8px" : "0",
                  }}
                />
              </div>
              <span className="w-6 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">
                {value}
              </span>
            </div>
          );
        })}
      </div>
      {(valueKey === "nightCount" || valueKey === "weekendCount" || valueKey === "maxConsecutive") && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
          <div className={`h-2 w-2 rounded ${barColor}`} /> 정상
          <div className={`ml-2 h-2 w-2 rounded ${warnColor}`} /> 평균 초과
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
      {icon}
      <p className="mt-2 text-base">{message}</p>
    </div>
  );
}
