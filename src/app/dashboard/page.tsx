import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CalendarDays, Users, Clock } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";

async function getDashboardData(wardId: string | null) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const wardFilter = wardId ? { wardId } : {};

  const [nurseCount, scheduleCount, pendingCount, pendingSchedules, recentChanges, recentSchedules] =
    await Promise.all([
      prisma.nurse.count({
        where: wardId ? { wardId, employmentStatus: "ACTIVE" } : { employmentStatus: "ACTIVE" },
      }),
      prisma.schedule.count({
        where: {
          year,
          month,
          ...wardFilter,
        },
      }),
      prisma.schedule.count({
        where: {
          status: { in: ["PENDING_MANAGER", "PENDING_DIRECTOR"] },
          ...wardFilter,
        },
      }),
      // Pending schedules (limit 10)
      prisma.schedule.findMany({
        where: {
          status: { in: ["PENDING_MANAGER", "PENDING_DIRECTOR"] },
          ...wardFilter,
        },
        take: 10,
        include: {
          ward: { select: { wardName: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Recent 10 schedule change logs
      prisma.scheduleChangeLog.findMany({
        where: wardFilter.wardId
          ? { schedule: { wardId: wardFilter.wardId } }
          : {},
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
      // Recent 5 schedules
      prisma.schedule.findMany({
        where: wardFilter,
        take: 5,
        include: {
          ward: { select: { wardName: true } },
        },
        orderBy: [
          { year: "desc" },
          { month: "desc" },
          { createdAt: "desc" },
        ],
      }),
    ]);

  return {
    nurseCount,
    scheduleCount,
    pendingCount,
    pendingSchedules,
    recentChanges,
    recentSchedules,
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
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const user = session.user as {
    id: string;
    name: string;
    role: string;
    wardId: string | null;
    wardName: string | null;
  };

  const showAllWards =
    user.role === "ADMIN" ||
    user.role === "NURSING_DIRECTOR" ||
    user.role === "NURSING_MANAGER";

  const data = await getDashboardData(showAllWards ? null : user.wardId);

  const statCards = [
    {
      title: "총 간호사",
      value: data.nurseCount,
      icon: Users,
      color: "bg-blue-500",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
    },
    {
      title: "금월 근무표",
      value: data.scheduleCount,
      icon: CalendarDays,
      color: "bg-green-500",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
    },
    {
      title: "승인 대기",
      value: data.pendingCount,
      icon: Clock,
      color: "bg-orange-500",
      bgColor: "bg-orange-50",
      textColor: "text-orange-700",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome message */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          안녕하세요, {user.name}님
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {user.wardName
            ? `${user.wardName} 근무표 관리 현황입니다.`
            : "전체 병동 근무표 관리 현황입니다."}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200"
            >
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {card.title}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {card.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${card.bgColor}`}
                  >
                    <Icon className={`h-6 w-6 ${card.textColor}`} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 승인 대기 근무표 */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">승인 대기 근무표</h3>
        </div>
        <div className="p-6">
          {data.pendingSchedules.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      병동
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      연월
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      상태
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      작성자
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.pendingSchedules.map((schedule) => (
                    <tr key={schedule.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {schedule.ward.wardName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {schedule.year}년 {schedule.month}월
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <Badge className={STATUS_COLORS[schedule.status] || ""}>
                          {STATUS_LABELS[schedule.status] || schedule.status}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {schedule.createdBy.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <Link
                          href={`/schedules/${schedule.id}/edit`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          보기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Clock className="h-12 w-12 mb-3" />
              <p className="text-sm">승인 대기 중인 근무표가 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 최근 활동 */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">최근 활동</h3>
        </div>
        <div className="p-6">
          {data.recentChanges.length > 0 ? (
            <ul className="space-y-4">
              {data.recentChanges.map((change) => (
                <li
                  key={change.id}
                  className="flex items-start gap-3 text-sm text-gray-700"
                >
                  <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  <div>
                    <span className="font-medium text-gray-900">
                      {change.nurse.name}
                    </span>
                    의 {change.schedule.year}년 {change.schedule.month}월 근무가
                    변경됨 -{" "}
                    <span className="font-medium text-gray-900">
                      {change.changedBy.name}
                    </span>
                    <span className="ml-2 text-gray-400">
                      ({formatTimeAgo(new Date(change.changedAt))})
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <CalendarDays className="h-12 w-12 mb-3" />
              <p className="text-sm">최근 활동 내역이 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 최근 근무표 */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">최근 근무표</h3>
        </div>
        <div className="p-6">
          {data.recentSchedules.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.recentSchedules.map((schedule) => (
                <Link
                  key={schedule.id}
                  href={`/schedules/${schedule.id}/edit`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {schedule.ward.wardName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {schedule.year}년 {schedule.month}월
                    </p>
                  </div>
                  <Badge className={STATUS_COLORS[schedule.status] || ""}>
                    {STATUS_LABELS[schedule.status] || schedule.status}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <CalendarDays className="h-12 w-12 mb-3" />
              <p className="text-sm">근무표가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
