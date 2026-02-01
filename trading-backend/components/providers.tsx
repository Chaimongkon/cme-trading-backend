"use client";

import { SWRConfig } from "swr";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { defaultSwrConfig } from "@/lib/swr-config";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Client-side providers wrapper
 * Includes:
 * - Error boundary for catching React errors
 * - SWR global config for data fetching
 * - Toast notifications
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // You can send errors to a logging service here
        console.error("Application Error:", {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        });
      }}
    >
      <SWRConfig value={defaultSwrConfig}>
        {children}
        <Toaster />
      </SWRConfig>
    </ErrorBoundary>
  );
}
