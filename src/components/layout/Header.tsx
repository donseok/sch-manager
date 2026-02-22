"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
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

export default function Header() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8 dark:border-slate-700 dark:bg-slate-900">
      {/* Left side: mobile menu button + page title */}
      <div className="flex items-center gap-4">
        {/* Spacer for mobile menu button */}
        <div className="w-10 lg:hidden" />
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{pageTitle}</h2>
      </div>

      {/* Right side: user info + theme toggle + logout */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {ROLE_LABELS[user.role] || user.role}
            </span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {user.name}
            </span>
          </div>
        )}
        <ThemeToggle />
        {user && (
          <button
            onClick={logout}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}
