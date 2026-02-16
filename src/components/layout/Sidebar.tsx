"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/schedules", label: "근무표 관리", icon: CalendarDays },
  { href: "/nurses", label: "간호사 관리", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = session?.user as
    | { name?: string; role?: string; wardName?: string }
    | undefined;

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo / Title */}
      <div className="flex h-16 items-center gap-2 border-b border-blue-700 px-6">
        <CalendarDays className="h-7 w-7 text-white" />
        <h1 className="text-lg font-bold text-white">근무표 관리시스템</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-700 text-white"
                  : "text-blue-100 hover:bg-blue-700/50 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-blue-700 px-4 py-4">
        {user && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-blue-200">
              {ROLE_LABELS[user.role || ""] || user.role}
              {user.wardName && ` | ${user.wardName}`}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-blue-100 transition-colors hover:bg-blue-700/50 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          로그아웃
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-blue-600 p-2 text-white shadow-lg lg:hidden"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-blue-800 transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-blue-800">
        {sidebarContent}
      </aside>
    </>
  );
}
