"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ui/ThemeToggle";

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

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8 dark:border-slate-700 dark:bg-slate-900">
      {/* Left side: mobile menu button + page title */}
      <div className="flex items-center gap-4">
        {/* Spacer for mobile menu button */}
        <div className="w-10 lg:hidden" />
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{pageTitle}</h2>
      </div>

      {/* Right side: theme toggle */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
      </div>
    </header>
  );
}
