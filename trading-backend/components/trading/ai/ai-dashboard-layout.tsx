"use client";

import { cn } from "@/lib/utils";

interface AIDashboardLayoutProps {
    children: React.ReactNode;
    className?: string;
}

export function AIDashboardLayout({
    children,
    className,
}: AIDashboardLayoutProps) {
    return (
        <div
            className={cn(
                "grid grid-cols-1 lg:grid-cols-12 gap-6 h-full p-6 overflow-hidden",
                className
            )}
        >
            {children}
        </div>
    );
}

export function AIControlSection({
    children,
    className,
}: AIDashboardLayoutProps) {
    return (
        <div
            className={cn(
                "lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-2",
                className
            )}
        >
            {children}
        </div>
    );
}

export function AIResultSection({
    children,
    className,
}: AIDashboardLayoutProps) {
    return (
        <div
            className={cn(
                "lg:col-span-8 flex flex-col gap-6 h-full overflow-y-auto pr-2",
                className
            )}
        >
            {children}
        </div>
    );
}
