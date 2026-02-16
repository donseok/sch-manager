import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CalendarDays, Users, Clock } from "lucide-react";

async function getDashboardStats(wardId: string | null) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [nurseCount, scheduleCount, pendingCount] = await Promise.all([
    prisma.nurse.count({
      where: wardId ? { wardId, employmentStatus: "ACTIVE" } : { employmentStatus: "ACTIVE" },
    }),
    prisma.schedule.count({
      where: {
        year,
        month,
        ...(wardId ? { wardId } : {}),
      },
    }),
    prisma.schedule.count({
      where: {
        status: { in: ["PENDING_MANAGER", "PENDING_DIRECTOR"] },
        ...(wardId ? { wardId } : {}),
      },
    }),
  ]);

  return { nurseCount, scheduleCount, pendingCount };
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

  const stats = await getDashboardStats(showAllWards ? null : user.wardId);

  const statCards = [
    {
      title: "총 간호사",
      value: stats.nurseCount,
      icon: Users,
      color: "bg-blue-500",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
    },
    {
      title: "금월 근무표",
      value: stats.scheduleCount,
      icon: CalendarDays,
      color: "bg-green-500",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
    },
    {
      title: "승인 대기",
      value: stats.pendingCount,
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

      {/* Recent activity placeholder */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">최근 활동</h3>
        </div>
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <CalendarDays className="h-12 w-12 mb-3" />
            <p className="text-sm">최근 활동 내역이 없습니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
