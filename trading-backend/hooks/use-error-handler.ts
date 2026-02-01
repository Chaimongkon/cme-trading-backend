"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { 
  AppError, 
  isAppError, 
  getErrorMessage, 
  isRetryableError,
  toAppError 
} from "@/lib/errors";

// ============================================
// Types
// ============================================

interface UseErrorHandlerOptions {
  /** Show toast on error */
  showToast?: boolean;
  /** Custom toast title */
  toastTitle?: string;
  /** Auto-retry on retryable errors */
  autoRetry?: boolean;
  /** Max retry attempts */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Callback when error occurs */
  onError?: (error: AppError) => void;
}

interface ErrorState {
  error: AppError | null;
  hasError: boolean;
  isRetrying: boolean;
  retryCount: number;
}

// ============================================
// Hook
// ============================================

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    showToast = true,
    toastTitle = "เกิดข้อผิดพลาด",
    autoRetry = false,
    maxRetries = 3,
    retryDelay = 1000,
    onError,
  } = options;

  const { toast } = useToast();

  const [state, setState] = useState<ErrorState>({
    error: null,
    hasError: false,
    isRetrying: false,
    retryCount: 0,
  });

  /**
   * Handle an error
   */
  const handleError = useCallback(
    (error: unknown) => {
      const appError = toAppError(error);

      setState((prev) => ({
        ...prev,
        error: appError,
        hasError: true,
      }));

      // Show toast notification
      if (showToast) {
        toast({
          title: toastTitle,
          description: getErrorMessage(appError),
          variant: "destructive",
        });
      }

      // Call custom error handler
      onError?.(appError);

      // Log error
      console.error("[Error Handler]", {
        code: appError.code,
        message: appError.message,
        context: appError.context,
      });
    },
    [showToast, toastTitle, toast, onError]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState({
      error: null,
      hasError: false,
      isRetrying: false,
      retryCount: 0,
    });
  }, []);

  /**
   * Execute an async function with error handling
   */
  const withErrorHandling = useCallback(
    async <T>(
      fn: () => Promise<T>,
      options?: { silent?: boolean }
    ): Promise<T | null> => {
      try {
        clearError();
        return await fn();
      } catch (error) {
        if (!options?.silent) {
          handleError(error);
        }
        return null;
      }
    },
    [handleError, clearError]
  );

  /**
   * Execute with retry logic
   */
  const withRetry = useCallback(
    async <T>(
      fn: () => Promise<T>,
      retries: number = maxRetries
    ): Promise<T | null> => {
      setState((prev) => ({ ...prev, isRetrying: true, retryCount: 0 }));

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await fn();
          setState((prev) => ({ ...prev, isRetrying: false }));
          clearError();
          return result;
        } catch (error) {
          const appError = toAppError(error);
          setState((prev) => ({
            ...prev,
            retryCount: attempt + 1,
          }));

          // Check if we should retry
          const shouldRetry = 
            attempt < retries && 
            (autoRetry || isRetryableError(appError));

          if (shouldRetry) {
            // Wait before retrying
            await new Promise((resolve) => 
              setTimeout(resolve, retryDelay * (attempt + 1))
            );
            continue;
          }

          // No more retries, handle the error
          handleError(error);
          setState((prev) => ({ ...prev, isRetrying: false }));
          return null;
        }
      }

      setState((prev) => ({ ...prev, isRetrying: false }));
      return null;
    },
    [maxRetries, retryDelay, autoRetry, handleError, clearError]
  );

  return {
    // State
    error: state.error,
    hasError: state.hasError,
    isRetrying: state.isRetrying,
    retryCount: state.retryCount,
    errorMessage: state.error ? getErrorMessage(state.error) : null,
    errorCode: state.error?.code ?? null,

    // Actions
    handleError,
    clearError,
    withErrorHandling,
    withRetry,
  };
}

// ============================================
// Simplified Hook for Common Use Cases
// ============================================

/**
 * Simple hook that just handles errors with toast
 */
export function useSimpleErrorHandler() {
  const { toast } = useToast();

  return useCallback((error: unknown, customMessage?: string) => {
    const message = customMessage || getErrorMessage(error);
    
    toast({
      title: "เกิดข้อผิดพลาด",
      description: message,
      variant: "destructive",
    });

    console.error("[Error]", error);
  }, [toast]);
}

/**
 * Hook for async operations with loading and error state
 */
export function useAsyncOperation<T>() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (
    fn: () => Promise<T>,
    options?: { 
      onSuccess?: (data: T) => void;
      onError?: (error: Error) => void;
    }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fn();
      setData(result);
      options?.onSuccess?.(result);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      options?.onError?.(err instanceof Error ? err : new Error(message));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    isLoading,
    error,
    data,
    execute,
    reset,
  };
}
