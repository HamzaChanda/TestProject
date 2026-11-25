import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

/** Numbered section used by the multi-step sale & purchase forms. */
export function FormSection({
  step,
  title,
  description,
  complete,
  actions,
  children,
  className,
}: {
  step: number;
  title: string;
  description?: string;
  complete?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-6 w-6 shrink-0 place-items-center rounded-full text-label font-semibold transition-colors",
              complete ? "bg-success-solid text-white" : "bg-brand-50 text-brand ring-1 ring-brand-100 ring-inset",
            )}
          >
            {complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : step}
          </span>
          <div>
            <h3 className="text-h3 font-semibold tracking-[-0.01em] text-ink">{title}</h3>
            {description && <p className="mt-0.5 text-label text-muted">{description}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </Card>
  );
}
