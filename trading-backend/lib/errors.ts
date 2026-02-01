/**
 * Custom Error Classes for Gold Options Analytics
 * 
 * Provides typed errors with Thai messages for better UX
 */

// ============================================
// Base Error Class
// ============================================

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
    };
  }
}

// ============================================
// API Errors
// ============================================

export class ApiError extends AppError {
  constructor(
    message: string,
    code: string = "API_ERROR",
    statusCode: number = 500,
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, true, context);
  }
}

export class NotFoundError extends ApiError {
  constructor(
    resource: string = "ข้อมูล",
    context?: Record<string, unknown>
  ) {
    super(
      `ไม่พบ${resource}ที่ต้องการ`,
      "NOT_FOUND",
      404,
      context
    );
  }
}

export class ValidationError extends ApiError {
  public readonly fields?: Record<string, string>;

  constructor(
    message: string = "ข้อมูลไม่ถูกต้อง",
    fields?: Record<string, string>,
    context?: Record<string, unknown>
  ) {
    super(message, "VALIDATION_ERROR", 400, context);
    this.fields = fields;
  }
}

export class DatabaseError extends ApiError {
  constructor(
    operation: string = "database",
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(
      `เกิดข้อผิดพลาดในการ${operation}`,
      "DATABASE_ERROR",
      500,
      { ...context, originalMessage: originalError?.message }
    );
  }
}

// ============================================
// Data Errors
// ============================================

export class NoDataError extends AppError {
  constructor(
    dataType: string = "ข้อมูล",
    context?: Record<string, unknown>
  ) {
    super(
      `ไม่มี${dataType}ในระบบ กรุณา sync ข้อมูลจาก Chrome Extension`,
      "NO_DATA",
      404,
      true,
      context
    );
  }
}

export class StaleDataError extends AppError {
  public readonly lastUpdated: Date;
  public readonly staleMinutes: number;

  constructor(
    lastUpdated: Date,
    staleMinutes: number = 30,
    context?: Record<string, unknown>
  ) {
    super(
      `ข้อมูลเก่าเกินไป (อัพเดทล่าสุด ${staleMinutes} นาทีที่แล้ว) กรุณา sync ข้อมูลใหม่`,
      "STALE_DATA",
      200, // Not an error, just a warning
      true,
      context
    );
    this.lastUpdated = lastUpdated;
    this.staleMinutes = staleMinutes;
  }
}

export class InvalidDataFormatError extends AppError {
  constructor(
    expectedFormat: string,
    receivedData?: unknown,
    context?: Record<string, unknown>
  ) {
    super(
      `รูปแบบข้อมูลไม่ถูกต้อง ต้องการ: ${expectedFormat}`,
      "INVALID_DATA_FORMAT",
      400,
      true,
      { ...context, receivedType: typeof receivedData }
    );
  }
}

// ============================================
// Analysis Errors
// ============================================

export class AnalysisError extends AppError {
  constructor(
    analysisType: string,
    reason: string,
    context?: Record<string, unknown>
  ) {
    super(
      `ไม่สามารถวิเคราะห์ ${analysisType}: ${reason}`,
      "ANALYSIS_ERROR",
      500,
      true,
      context
    );
  }
}

export class InsufficientDataError extends AppError {
  public readonly required: number;
  public readonly received: number;

  constructor(
    dataType: string,
    required: number,
    received: number,
    context?: Record<string, unknown>
  ) {
    super(
      `ข้อมูล${dataType}ไม่เพียงพอ (ต้องการ ${required}, มี ${received})`,
      "INSUFFICIENT_DATA",
      400,
      true,
      context
    );
    this.required = required;
    this.received = received;
  }
}

// ============================================
// Network/External Errors
// ============================================

export class NetworkError extends AppError {
  constructor(
    service: string = "เซิร์ฟเวอร์",
    context?: Record<string, unknown>
  ) {
    super(
      `ไม่สามารถเชื่อมต่อกับ${service}ได้ กรุณาลองใหม่อีกครั้ง`,
      "NETWORK_ERROR",
      503,
      true,
      context
    );
  }
}

export class TelegramError extends AppError {
  constructor(
    action: string = "ส่งข้อความ",
    telegramError?: string,
    context?: Record<string, unknown>
  ) {
    super(
      `ไม่สามารถ${action} Telegram: ${telegramError || "ไม่ทราบสาเหตุ"}`,
      "TELEGRAM_ERROR",
      500,
      true,
      context
    );
  }
}

export class ExternalApiError extends AppError {
  public readonly externalService: string;
  public readonly externalStatusCode?: number;

  constructor(
    service: string,
    message: string,
    externalStatusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(
      `ข้อผิดพลาดจาก ${service}: ${message}`,
      "EXTERNAL_API_ERROR",
      502,
      true,
      context
    );
    this.externalService = service;
    this.externalStatusCode = externalStatusCode;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      "UNKNOWN_ERROR",
      500,
      false,
      { originalName: error.name, stack: error.stack }
    );
  }

  return new AppError(
    String(error),
    "UNKNOWN_ERROR",
    500,
    false
  );
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes("fetch")) {
      return "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้";
    }
    if (error.message.includes("timeout")) {
      return "การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่";
    }
    if (error.message.includes("network")) {
      return "เกิดปัญหาการเชื่อมต่อเครือข่าย";
    }
    return error.message;
  }

  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}

/**
 * Get error code for logging/tracking
 */
export function getErrorCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }
  return "UNKNOWN_ERROR";
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isAppError(error)) {
    const retryableCodes = [
      "NETWORK_ERROR",
      "EXTERNAL_API_ERROR",
      "DATABASE_ERROR",
    ];
    return retryableCodes.includes(error.code);
  }
  
  if (error instanceof Error) {
    return error.message.includes("timeout") || 
           error.message.includes("network") ||
           error.message.includes("ECONNRESET");
  }
  
  return false;
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: unknown) {
  const appError = toAppError(error);
  
  return {
    success: false,
    error: {
      message: appError.message,
      code: appError.code,
      timestamp: appError.timestamp.toISOString(),
      ...(process.env.NODE_ENV === "development" && {
        context: appError.context,
        stack: appError.stack,
      }),
    },
  };
}
