"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Clock, Zap, Activity } from "lucide-react";
import { AIAnalysisResult } from "./types";

export function AIStatsCards({ result }: { result: AIAnalysisResult }) {
    return (
        <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard
                icon={<Zap className="h-4 w-4 text-yellow-500" />}
                label="โมเดล"
                value={result.model}
            />
            <StatCard
                icon={<Clock className="h-4 w-4 text-blue-500" />}
                label="เวลาประมวลผล"
                value={`${(result.processing_time_ms / 1000).toFixed(2)}s`}
            />
            <StatCard
                icon={<Activity className="h-4 w-4 text-purple-500" />}
                label="โทเคน"
                value="~1.2k" // Placeholder or actual if available
            />
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <Card className="bg-card/30 border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-full bg-background/50">{icon}</div>
                <div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-sm font-bold">{value}</div>
                </div>
            </CardContent>
        </Card>
    );
}
