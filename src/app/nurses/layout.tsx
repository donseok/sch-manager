import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function NursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
