import { Skeleton } from "@/components/ui/Primitives";

/**
 * Shown instantly while a route segment loads (first compile in dev, slow
 * network, dynamic detail pages). Mirrors the real page structure — header,
 * KPI row, table card — so content replaces it without the layout jumping.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-[9px]" />
          <Skeleton className="h-9 w-32 rounded-[9px]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-4 h-7 w-28" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="flex gap-2 px-5 py-4">
          <Skeleton className="h-9 w-64 rounded-[9px]" />
          <Skeleton className="h-9 w-36 rounded-[9px]" />
        </div>
        <div className="border-t border-line">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-0">
              <Skeleton className="h-8 w-8 rounded-[9px]" />
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="ml-auto h-3.5 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
