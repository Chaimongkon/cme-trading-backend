import { cn } from "@/lib/utils";

// ============================================
// Base Skeleton Component
// ============================================

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Animation type */
  animation?: "pulse" | "shimmer" | "none";
}

export function Skeleton({ 
  className, 
  animation = "pulse",
  ...props 
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted",
        animation === "pulse" && "animate-pulse",
        animation === "shimmer" && "animate-shimmer bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  );
}

// ============================================
// Skeleton Variants
// ============================================

/** Text skeleton - for paragraphs and labels */
export function SkeletonText({ 
  lines = 1, 
  className = "" 
}: { 
  lines?: number; 
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )} 
        />
      ))}
    </div>
  );
}

/** Circle skeleton - for avatars and icons */
export function SkeletonCircle({ 
  size = "md",
  className = "" 
}: { 
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  return (
    <Skeleton className={cn("rounded-full", sizeClasses[size], className)} />
  );
}

// ============================================
// Dashboard Skeletons
// ============================================

/** Skeleton for stat cards */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/40 p-6 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <SkeletonCircle size="lg" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/** Skeleton for signal display */
export function SkeletonSignal({ className = "" }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/40 overflow-hidden", className)}>
      {/* Header bar */}
      <Skeleton className="h-1 w-full rounded-none" />
      
      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Title */}
        <div className="flex items-center gap-2">
          <SkeletonCircle size="sm" />
          <Skeleton className="h-5 w-32" />
        </div>
        
        {/* Signal badge */}
        <div className="flex justify-center py-4">
          <Skeleton className="h-12 w-36 rounded-xl" />
        </div>
        
        {/* Strength bar */}
        <div className="flex items-center justify-center gap-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-2 w-6" />
            ))}
          </div>
        </div>
        
        {/* Factors */}
        <div className="space-y-2 pt-4 border-t border-border/40">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for chart */
export function SkeletonChart({ 
  height = 300,
  className = "" 
}: { 
  height?: number;
  className?: string;
}) {
  // Fixed heights to avoid hydration mismatch
  const barHeights = [45, 65, 55, 80, 40, 70, 50, 75, 60, 85, 35, 55];
  
  return (
    <div className={cn("rounded-xl border border-border/40 overflow-hidden", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkeletonCircle size="sm" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      
      {/* Chart area */}
      <div className="p-4" style={{ height }}>
        <div className="h-full flex items-end justify-around gap-2">
          {barHeights.map((h, i) => (
            <Skeleton 
              key={i} 
              className="flex-1"
              style={{ height: `${h}%` }} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for table */
export function SkeletonTable({ 
  rows = 5,
  cols = 4,
  className = "" 
}: { 
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/40 overflow-hidden", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border/40 bg-muted/30">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      <div className="divide-y divide-border/40">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="flex gap-4">
              {Array.from({ length: cols }).map((_, colIndex) => (
                <Skeleton 
                  key={colIndex} 
                  className={cn(
                    "h-4 flex-1",
                    colIndex === 0 && "w-1/4",
                  )} 
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for timeline/list items */
export function SkeletonTimeline({ 
  items = 5,
  className = "" 
}: { 
  items?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {/* Timeline dot */}
          <div className="flex flex-col items-center">
            <SkeletonCircle size="sm" />
            {i < items - 1 && (
              <Skeleton className="w-0.5 flex-1 mt-2" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="rounded-lg border border-border/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Page-Level Skeletons
// ============================================

/** Full dashboard page skeleton */
export function SkeletonDashboard() {
  return (
    <div className="space-y-6 p-6">
      {/* Hero section */}
      <div className="rounded-xl border border-border/40 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-24 w-32 rounded-xl" />
            <Skeleton className="h-24 w-32 rounded-xl" />
            <Skeleton className="h-24 w-32 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SkeletonChart height={300} />
          <SkeletonChart height={250} />
        </div>
        <div className="space-y-6">
          <SkeletonSignal />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

/** Signals page skeleton */
export function SkeletonSignalsPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Hero section */}
      <div className="rounded-xl border border-border/40 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-4 w-64 rounded-full" />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="p-4">
          <SkeletonTimeline items={5} />
        </div>
      </div>
    </div>
  );
}

/** History page skeleton */
export function SkeletonHistoryPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Hero stats */}
      <div className="rounded-xl border border-border/40 p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="text-center space-y-2">
              <Skeleton className="h-4 w-20 mx-auto" />
              <Skeleton className="h-8 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center">
        <Skeleton className="h-10 w-80 rounded-lg" />
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>

        {/* Main content */}
        <div className="lg:col-span-9 space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonChart height={300} />
          <SkeletonTable rows={8} cols={5} />
        </div>
      </div>
    </div>
  );
}

/** Analyze page skeleton */
export function SkeletonAnalyzePage() {
  return (
    <div className="space-y-6 p-6">
      {/* Hero */}
      <div className="rounded-xl border border-border/40 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center">
        <Skeleton className="h-12 w-96 rounded-lg" />
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SkeletonSignal />
        </div>
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/40 p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <SkeletonText lines={8} />
          </div>
        </div>
      </div>
    </div>
  );
}
