"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wifi, WifiOff, CloudDownload, Loader2, Check, AlertCircle } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  lastUpdated?: string;
  showSyncButton?: boolean;
  children?: React.ReactNode;
}

type SyncStatus = "idle" | "syncing" | "success" | "error";

export function Header({
  title,
  subtitle,
  onRefresh,
  isLoading,
  lastUpdated,
  showSyncButton = true,
  children,
}: HeaderProps) {
  const [isConnected] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [connectedClients, setConnectedClients] = useState<number | null>(null);

  // Trigger sync to extension
  const triggerExtensionSync = useCallback(async () => {
    setSyncStatus("syncing");

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger",
          type: "REFRESH_ALL",
        }),
      });

      const result = await response.json();

      if (result.success) {
        setConnectedClients(result.connectedClients);
        setSyncStatus("success");

        // Also refresh local data after a delay
        setTimeout(() => {
          onRefresh?.();
        }, 3000);
      } else {
        setSyncStatus("error");
      }
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus("error");
    }

    // Reset status after delay
    setTimeout(() => {
      setSyncStatus("idle");
    }, 5000);
  }, [onRefresh]);

  // Check status on mount
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status" }),
        });
        const result = await response.json();
        if (result.success && isMounted) {
          setConnectedClients(result.connectedClients);
        }
      } catch (e) {
        // Ignore errors
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {children}

        {/* Connection Status */}
        <div className="flex items-center gap-2 text-sm">
          {isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground hidden sm:inline">เชื่อมต่อแล้ว</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-500" />
              <span className="text-muted-foreground hidden sm:inline">ไม่ได้เชื่อมต่อ</span>
            </>
          )}
        </div>

        {lastUpdated && (
          <div className="text-sm text-muted-foreground hidden md:block">
            อัพเดทล่าสุด: {lastUpdated}
          </div>
        )}

        {/* Sync Extension Button */}
        {showSyncButton && (
          <Button
            variant={syncStatus === "success" ? "default" : syncStatus === "error" ? "destructive" : "outline"}
            size="sm"
            onClick={triggerExtensionSync}
            disabled={syncStatus === "syncing"}
            className="gap-2"
          >
            {syncStatus === "syncing" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {syncStatus === "success" && (
              <Check className="h-4 w-4" />
            )}
            {syncStatus === "error" && (
              <AlertCircle className="h-4 w-4" />
            )}
            {syncStatus === "idle" && (
              <CloudDownload className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {syncStatus === "syncing" && "กำลัง Sync..."}
              {syncStatus === "success" && "Sync สำเร็จ!"}
              {syncStatus === "error" && "Sync ล้มเหลว"}
              {syncStatus === "idle" && "Sync Extension"}
            </span>
            {connectedClients !== null && syncStatus === "idle" && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {connectedClients}
              </Badge>
            )}
          </Button>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
            <span className="hidden sm:inline">รีเฟรช</span>
          </Button>
        )}
      </div>
    </header>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
