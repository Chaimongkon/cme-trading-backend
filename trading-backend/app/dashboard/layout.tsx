import { Sidebar } from "@/components/layout/sidebar";
import { Providers } from "@/components/providers";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-background">{children}</main>
      </div>
    </Providers>
  );
}
