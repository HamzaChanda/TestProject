import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sheet (level 1 surface): white, 1px line, radius 10, NO shadow.
 * Used to group — tables, forms, panels — never to wrap a lone number.
 * `Card` is kept as an alias for legacy pages.
 */
export function Sheet({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-panel border border-line bg-surface", className)} {...props} />;
}
export const Card = Sheet;

/** 48px sheet header with a bottom rule: h3 title, optional description and actions. */
export function SheetHeader({
  title,
  description,
  actions,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 md:px-5", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-h3 font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="text-label text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Legacy header used by not-yet-redesigned pages (no rule). */
export function CardHeader({
  title,
  description,
  actions,
  className,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <div className="mt-0.5 text-muted">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-h3 font-semibold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-label text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-line", className)} />;
}
