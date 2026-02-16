"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Badge from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/dashboard": "대시보드",
  "/schedules": "근무표 관리",
  "/nurses": "간호사 관리",
};

function getPageTitle(pathname: string | null): string {
  if (!pathname) return "";
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      return title;
    }
  }
  return "";
}

function getRoleBadgeVariant(
  role: string
): "primary" | "success" | "warning" | "info" | "default" {
  switch (role) {
    case "ADMIN":
      return "danger" as "primary" | "success" | "warning" | "info" | "default";
    case "NURSING_DIRECTOR":
      return "info";
    case "NURSING_MANAGER":
      return "warning";
    case "HEAD_NURSE":
      return "primary";
    default:
      return "default";
  }
}

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const user = session?.user as
    | { name?: string; role?: string; wardName?: string }
    | undefined;
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-8">
      {/* Left side: mobile menu button + page title */}
      <div className="flex items-center gap-4">
        {/* Spacer for mobile menu button */}
        <div className="w-10 lg:hidden" />
        <h2 className="text-xl font-semibold text-gray-900">{pageTitle}</h2>
      </div>

      {/* Right side: user info */}
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {user.name}
          </span>
          <Badge variant={getRoleBadgeVariant(user.role || "")}>
            {ROLE_LABELS[user.role || ""] || user.role}
          </Badge>
        </div>
      )}
    </header>
  );
}
