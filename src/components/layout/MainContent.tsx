"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";

interface MainContentProps {
  children: ReactNode;
  className?: string;
}

export default function MainContent({ children, className }: MainContentProps) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        "flex flex-1 flex-col transition-all duration-200 ease-in-out",
        collapsed ? "lg:pl-16" : "lg:pl-64",
        className
      )}
    >
      {children}
    </div>
  );
}
