"use client";

import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import { SidebarProvider } from "@/contexts/SidebarContext";

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider>{children}</SidebarProvider>
    </ThemeProvider>
  );
}
