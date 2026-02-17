import { SidebarProvider } from "@/components/layout/SidebarContext";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MainContent from "@/components/layout/MainContent";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
        <Sidebar />
        <MainContent>
          <Header />
          <main className="flex-1 p-4 lg:p-8">{children}</main>
          <footer className="shrink-0 border-t border-slate-200 px-4 py-3 text-center text-sm text-slate-400 lg:px-8 dark:border-slate-700 dark:text-slate-500">
            &copy; {new Date().getFullYear()} Busan Medical Center 42병동. All rights reserved.
          </footer>
        </MainContent>
      </div>
    </SidebarProvider>
  );
}
