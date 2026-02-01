"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  History,
  Bell,
  Settings,
  TrendingUp,
  Zap,
  Brain,
  Send,
} from "lucide-react";

const navigation = [
  {
    name: "แดชบอร์ด",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "วิเคราะห์",
    href: "/dashboard/analyze",
    icon: Zap,
  },
  {
    name: "AI วิเคราะห์",
    href: "/dashboard/ai",
    icon: Brain,
  },
  {
    name: "MT5 Orders",
    href: "/dashboard/mt5",
    icon: Send,
  },
  {
    name: "ประวัติ",
    href: "/dashboard/history",
    icon: History,
  },
  {
    name: "สัญญาณ",
    href: "/dashboard/signals",
    icon: Bell,
  },
  {
    name: "ตั้งค่า",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
        <TrendingUp className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-lg font-bold text-foreground">วิเคราะห์ XAU</h1>
          <p className="text-xs text-muted-foreground">ตัวเลือก Options</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground text-center">
          CME Options Data Extractor
        </p>
      </div>
    </div>
  );
}
