"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Brain,
    Sparkles,
    Zap,
    RefreshCw,
    Settings2,
    Activity,
    Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalysisMode, ProviderType } from "./types";

interface AIControlsProps {
    onAnalyze: (provider: ProviderType, mode: AnalysisMode) => void;
    isLoading: boolean;
    currentMode: AnalysisMode;
    onModeChange: (mode: AnalysisMode) => void;
}

export function AIControls({
    onAnalyze,
    isLoading,
    currentMode,
    onModeChange,
}: AIControlsProps) {
    const [selectedProvider, setSelectedProvider] = useState<ProviderType>("auto");

    return (
        <div className="space-y-6">
            {/* Main Action Card */}
            <Card className="border-gold/30 bg-gradient-to-br from-gold/5 to-purple-500/5 overflow-hidden relative group">
                <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <CardHeader className="relative z-10">
                    <CardTitle className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gold/20 text-gold">
                            <Brain className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">ศูนย์บัญชาการ AI</h2>
                            <p className="text-sm text-muted-foreground font-normal">
                                เลือกกลยุทธ์การวิเคราะห์ของคุณ
                            </p>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10">
                    {/* Mode Selection */}
                    <div className="grid grid-cols-1 gap-3">
                        <ModeButton
                            active={currentMode === "enhanced"}
                            onClick={() => onModeChange("enhanced")}
                            icon={<Sparkles className="h-5 w-5" />}
                            title="วิเคราะห์แบบเจาะลึก (Enhanced)"
                            description="รวมเทคนิค, ประวัติกราฟ และข่าวเศรษฐกิจ"
                            color="text-purple-500"
                            borderColor="border-purple-500/50"
                            bgActive="bg-purple-500/10"
                        />
                        <ModeButton
                            active={currentMode === "consensus"}
                            onClick={() => onModeChange("consensus")}
                            icon={<Users className="h-5 w-5" />}
                            title="ความเห็นร่วม (Multi-AI)"
                            description="รวบรวมความเห็นจากหลายโมเดล"
                            color="text-blue-500"
                            borderColor="border-blue-500/50"
                            bgActive="bg-blue-500/10"
                        />
                        <ModeButton
                            active={currentMode === "standard"}
                            onClick={() => onModeChange("standard")}
                            icon={<Activity className="h-5 w-5" />}
                            title="วิเคราะห์มาตรฐาน (Standard)"
                            description="วิเคราะห์รวดเร็วจากข้อมูล Options"
                            color="text-gray-500"
                            borderColor="border-gray-500/50"
                            bgActive="bg-gray-500/10"
                        />
                    </div>

                    {/* Analyze Button */}
                    <Button
                        onClick={() => onAnalyze(selectedProvider, currentMode)}
                        disabled={isLoading}
                        className={cn(
                            "w-full h-14 text-lg font-bold shadow-lg transition-all duration-300",
                            isLoading
                                ? "bg-muted cursor-not-allowed"
                                : "bg-gradient-to-r from-gold to-yellow-500 hover:from-yellow-400 hover:to-gold hover:shadow-gold/20 hover:scale-[1.02]"
                        )}
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                                กำลังประมวลผลข้อมูลตลาด...
                            </>
                        ) : (
                            <>
                                <Zap className="h-5 w-5 mr-2 fill-current" />
                                เริ่มวิเคราะห์
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Advanced Settings (Provider Selection) */}
            {currentMode !== "consensus" && (
                <Card className="border-border/50 bg-card/30 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                            <Settings2 className="h-4 w-4" />
                            เลือกโมเดล AI
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                            <ProviderButton
                                active={selectedProvider === "auto"}
                                onClick={() => setSelectedProvider("auto")}
                                label="Auto (Best)"
                            />
                            <ProviderButton
                                active={selectedProvider === "deepseek"}
                                onClick={() => setSelectedProvider("deepseek")}
                                label="DeepSeek V3"
                            />
                            <ProviderButton
                                active={selectedProvider === "deepseek-r1"}
                                onClick={() => setSelectedProvider("deepseek-r1")}
                                label="DeepSeek R1"
                            />
                            <ProviderButton
                                active={selectedProvider === "gemini"}
                                onClick={() => setSelectedProvider("gemini")}
                                label="Gemini Pro"
                            />
                            <ProviderButton
                                active={selectedProvider === "openai"}
                                onClick={() => setSelectedProvider("openai")}
                                label="GPT-4o"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function ModeButton({
    active,
    onClick,
    icon,
    title,
    description,
    color,
    borderColor,
    bgActive,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string;
    borderColor: string;
    bgActive: string;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-200",
                active
                    ? cn(borderColor, bgActive, "shadow-sm")
                    : "border-transparent hover:bg-muted/50"
            )}
        >
            <div className={cn("mt-1", color)}>{icon}</div>
            <div>
                <div className={cn("font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                    {title}
                </div>
                <div className="text-xs text-muted-foreground">{description}</div>
            </div>
            {active && (
                <Badge variant="outline" className="ml-auto bg-background/50 border-0">
                    Selected
                </Badge>
            )}
        </button>
    );
}

function ProviderButton({
    active,
    onClick,
    label,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <Button
            variant={active ? "secondary" : "outline"}
            size="sm"
            onClick={onClick}
            className={cn(
                "justify-start font-normal",
                active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
            )}
        >
            {active && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />}
            {label}
        </Button>
    );
}
