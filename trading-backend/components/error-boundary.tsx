"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import Link from "next/link";

// ============================================
// Error Boundary Props & State
// ============================================

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// ============================================
// Error Boundary Component (Class Component)
// ============================================

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error);
      console.error("Component stack:", errorInfo.componentStack);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          showDetails={this.props.showDetails}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================
// Error Fallback Component
// ============================================

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo?: React.ErrorInfo | null;
  onReset?: () => void;
  showDetails?: boolean;
}

export function ErrorFallback({
  error,
  errorInfo,
  onReset,
  showDetails = process.env.NODE_ENV === "development",
}: ErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg border-destructive/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">
            เกิดข้อผิดพลาด
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            {error?.message || "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง"}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {onReset && (
              <Button onClick={onReset} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                ลองใหม่
              </Button>
            )}
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              รีเฟรชหน้า
            </Button>
            <Link href="/dashboard">
              <Button variant="ghost" className="gap-2 w-full sm:w-auto">
                <Home className="h-4 w-4" />
                กลับหน้าหลัก
              </Button>
            </Link>
          </div>

          {/* Error Details (Development only) */}
          {showDetails && error && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground flex items-center gap-2">
                <Bug className="h-4 w-4" />
                รายละเอียดข้อผิดพลาด (Development)
              </summary>
              <div className="mt-2 p-3 bg-muted rounded-lg overflow-auto">
                <p className="text-xs font-mono text-destructive mb-2">
                  {error.name}: {error.message}
                </p>
                {error.stack && (
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                )}
                {errorInfo?.componentStack && (
                  <>
                    <p className="text-xs font-mono text-muted-foreground mt-4 mb-1">
                      Component Stack:
                    </p>
                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Inline Error Component (for smaller errors)
// ============================================

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function InlineError({ message, onRetry, className = "" }: InlineErrorProps) {
  return (
    <div className={`flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg ${className}`}>
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      <p className="text-sm text-destructive flex-1">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="ghost"
          size="sm"
          className="shrink-0 text-destructive hover:text-destructive"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          ลองใหม่
        </Button>
      )}
    </div>
  );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================
// Loading Error Component (for async data)
// ============================================

interface LoadingErrorProps {
  error: Error | string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function LoadingError({ error, onRetry, isRetrying }: LoadingErrorProps) {
  const message = typeof error === "string" ? error : error?.message || "เกิดข้อผิดพลาด";
  
  return (
    <Card className="border-destructive/30">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="p-3 rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h4 className="font-medium text-destructive mb-1">
              ไม่สามารถโหลดข้อมูลได้
            </h4>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          {onRetry && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "กำลังลอง..." : "ลองใหม่"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// API Error Component
// ============================================

interface ApiErrorProps {
  statusCode?: number;
  message?: string;
  onRetry?: () => void;
}

export function ApiError({ statusCode, message, onRetry }: ApiErrorProps) {
  const getErrorInfo = () => {
    switch (statusCode) {
      case 400:
        return {
          title: "ข้อมูลไม่ถูกต้อง",
          description: message || "กรุณาตรวจสอบข้อมูลที่ส่งมา",
        };
      case 401:
        return {
          title: "ไม่ได้รับอนุญาต",
          description: "กรุณาเข้าสู่ระบบใหม่",
        };
      case 403:
        return {
          title: "ไม่มีสิทธิ์เข้าถึง",
          description: "คุณไม่มีสิทธิ์ในการดำเนินการนี้",
        };
      case 404:
        return {
          title: "ไม่พบข้อมูล",
          description: message || "ข้อมูลที่ต้องการไม่มีในระบบ",
        };
      case 500:
        return {
          title: "เซิร์ฟเวอร์มีปัญหา",
          description: "กรุณาลองใหม่ภายหลัง",
        };
      case 503:
        return {
          title: "ระบบไม่พร้อมให้บริการ",
          description: "กรุณารอสักครู่แล้วลองใหม่",
        };
      default:
        return {
          title: "เกิดข้อผิดพลาด",
          description: message || "กรุณาลองใหม่อีกครั้ง",
        };
    }
  };

  const { title, description } = getErrorInfo();

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <span className="text-2xl font-bold text-destructive">
          {statusCode || "!"}
        </span>
      </div>
      <h3 className="text-lg font-medium text-destructive mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          ลองใหม่
        </Button>
      )}
    </div>
  );
}
