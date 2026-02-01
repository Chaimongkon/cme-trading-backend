"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Send, Check, AlertCircle, Loader2 } from "lucide-react";

interface Settings {
  telegramConfigured: boolean;
  telegramChatId: string | null;
  signalThreshold: number;
  analysisInterval: number;
  updatedAt: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Form state
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [signalThreshold, setSignalThreshold] = useState(3);
  const [analysisInterval, setAnalysisInterval] = useState(5);
  const [enableNotifications, setEnableNotifications] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings");
      const result = await response.json();
      if (result.success) {
        setSettings(result.settings);
        setSignalThreshold(result.settings.signalThreshold);
        setAnalysisInterval(result.settings.analysisInterval);
        setEnableNotifications(result.settings.telegramConfigured);
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramBotToken: telegramBotToken || undefined,
          telegramChatId: telegramChatId || undefined,
          signalThreshold,
          analysisInterval,
        }),
      });
      const result = await response.json();

      if (result.success) {
        toast({
          title: "บันทึกสำเร็จ",
          description: "การตั้งค่าของคุณได้รับการอัพเดทแล้ว",
          variant: "success",
        });
        fetchSettings();
        setTelegramBotToken("");
        setTelegramChatId("");
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถบันทึกการตั้งค่าได้",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึกการตั้งค่าได้",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if (!telegramBotToken || !telegramChatId) {
      toast({
        title: "ข้อมูลไม่ครบ",
        description: "กรุณากรอก Bot Token และ Chat ID",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramBotToken,
          telegramChatId,
          testNotification: true,
        }),
      });
      const result = await response.json();

      if (result.success) {
        toast({
          title: "ส่งทดสอบสำเร็จ",
          description: "ตรวจสอบข้อความทดสอบใน Telegram ของคุณ!",
          variant: "success",
        });
      } else {
        toast({
          title: "ทดสอบล้มเหลว",
          description: result.error || "ไม่สามารถส่งข้อความทดสอบได้",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถส่งข้อความทดสอบได้",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ตั้งค่า" subtitle="ตั้งค่าระบบเทรดของคุณ" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="ตั้งค่า" subtitle="ตั้งค่าระบบเทรดของคุณ" />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Telegram Settings */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              แจ้งเตือน Telegram
            </CardTitle>
            <CardDescription>
              ตั้งค่า Telegram bot สำหรับรับสัญญาณเทรด
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              {settings?.telegramConfigured ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm">
                    ตั้งค่า Telegram แล้ว (Chat ID: {settings.telegramChatId})
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">
                    ยังไม่ได้ตั้งค่า Telegram
                  </span>
                </>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="botToken">Bot Token</Label>
                <Input
                  id="botToken"
                  type="password"
                  placeholder="กรอก Bot Token ของคุณ"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  รับได้จาก @BotFather บน Telegram
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="chatId">Chat ID</Label>
                <Input
                  id="chatId"
                  placeholder="กรอก Chat ID ของคุณ"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  รับได้จาก @userinfobot บน Telegram
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleTestNotification}
              disabled={isTesting || !telegramBotToken || !telegramChatId}
            >
              {isTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              ส่งข้อความทดสอบ
            </Button>
          </CardContent>
        </Card>

        {/* Signal Settings */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">ตั้งค่าสัญญาณ</CardTitle>
            <CardDescription>
              กำหนดเงื่อนไขการแจ้งเตือนสัญญาณ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="threshold">
                ความแรงสัญญาณขั้นต่ำ ({signalThreshold}/5)
              </Label>
              <Input
                id="threshold"
                type="range"
                min="1"
                max="5"
                value={signalThreshold}
                onChange={(e) => setSignalThreshold(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ทุกสัญญาณ</span>
                <span>เฉพาะสัญญาณแรง</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interval">
                ช่วงเวลาวิเคราะห์ ({analysisInterval} นาที)
              </Label>
              <Input
                id="interval"
                type="number"
                min="1"
                max="60"
                value={analysisInterval}
                onChange={(e) => setAnalysisInterval(parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                ความถี่ในการวิเคราะห์ข้อมูลที่เข้ามา
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <Label>เปิดใช้การแจ้งเตือน</Label>
                <p className="text-xs text-muted-foreground">
                  ส่งสัญญาณไป Telegram เมื่อถึงเกณฑ์ที่กำหนด
                </p>
              </div>
              <Switch
                checked={enableNotifications}
                onCheckedChange={setEnableNotifications}
                disabled={!settings?.telegramConfigured}
              />
            </div>
          </CardContent>
        </Card>

        {/* Extension Info */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Chrome Extension</CardTitle>
            <CardDescription>
              ตั้งค่า CME QuikStrike Data Extractor extension
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm font-medium mb-2">URL ของ Backend:</p>
              <code className="text-sm text-primary bg-background px-2 py-1 rounded">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/api/data`
                  : "http://localhost:3000/api/data"}
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              ตั้งค่า URL นี้ใน extension settings และเปิด &quot;Sync to Backend&quot;
              เพื่อเริ่มรับข้อมูล
            </p>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            บันทึกการตั้งค่า
          </Button>
        </div>
      </div>
    </div>
  );
}
