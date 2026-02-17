"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/schedules", label: "근무표 관리", icon: CalendarDays },
  { href: "/nurses", label: "간호사 관리", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isCollapsed, toggleCollapse } = useSidebar();

  const renderContent = (collapsed: boolean) => (
    <div className="flex h-full flex-col">
      {/* Logo / Title */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-navy-800",
          collapsed ? "justify-center px-2" : "gap-2 px-6"
        )}
      >
        <CalendarDays className="h-7 w-7 shrink-0 text-white" />
        {!collapsed && (
          <h1 className="overflow-hidden whitespace-nowrap text-xl font-bold text-white">
            근무표 관리시스템
          </h1>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 py-4", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            메뉴
          </p>
        )}
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-base font-medium transition-colors",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "border-l-2 border-blue-400 bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <span className="overflow-hidden whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Collapse toggle (desktop only, hidden on mobile via CSS) */}
      <div className="hidden border-t border-navy-800 p-3 lg:block">
        <button
          onClick={toggleCollapse}
          className={cn(
            "flex w-full items-center rounded-lg py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white",
            collapsed ? "justify-center px-2" : "gap-2 px-3"
          )}
          title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span>메뉴 접기</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-navy-900 p-2 text-white shadow-lg lg:hidden"
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

      {/* Mobile sidebar — always expanded */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-navy-900 transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {renderContent(false)}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden bg-navy-900 transition-all duration-300 ease-in-out lg:fixed lg:inset-y-0 lg:flex lg:flex-col",
          isCollapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        {renderContent(isCollapsed)}
      </aside>
    </>
  );
}
