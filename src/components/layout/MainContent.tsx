"use client";

import { useSidebar } from "./SidebarContext";
import { cn } from "@/lib/utils";

export default function MainContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isCollapsed } = useSidebar();

  return (
    <div
      className={cn(
        "flex flex-1 flex-col transition-all duration-300 ease-in-out",
        isCollapsed ? "lg:pl-20" : "lg:pl-64",
        className
      )}
    >
      {children}
    </div>
  );
}
