import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared control surface (inputs, textareas, combobox & date triggers).
 * Border uses the `control` token (3.16:1, WCAG 1.4.11). Forms are 36px, toolbars 32px.
 */
export const controlClass =
  "w-full rounded-control border border-control bg-surface px-2.5 text-body text-ink placeholder:text-faint " +
  "transition-[border-color,box-shadow] duration-[80ms] hover:border-ink-2 focus:border-petrol-500 focus:outline-none " +
  "focus:ring-[3px] focus:ring-petrol-500/20 disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-subtle disabled:text-muted " +
  "aria-[invalid=true]:border-danger-solid aria-[invalid=true]:focus:ring-danger-solid/20 " +
  "data-[invalid=true]:border-danger-solid data-[invalid=true]:focus:ring-danger-solid/20";
const control = controlClass;

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
  aside,
}: {
  label?: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={htmlFor} className="text-label font-medium text-ink-2">
            {label}
            {required && <span className="ml-0.5 text-danger">*</span>}
          </label>
          {aside}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-label text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-label text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** 32px (table/toolbar rows) instead of the 36px form height. */
  compact?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leading, trailing, compact, onWheel, ...props },
  ref,
) {
  // Scrolling the page over a focused number field must not change its value.
  const wheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (props.type === "number") e.currentTarget.blur();
    onWheel?.(e);
  };
  if (leading || trailing) {
    return (
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body-sm text-muted">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(control, compact ? "h-8" : "h-9", leading && (String(leading).length > 1 ? "pl-12" : "pl-8"), trailing && "pr-10", className)}
          onWheel={wheel}
          {...props}
        />
        {trailing && <span className="absolute inset-y-0 right-3 flex items-center text-label text-muted">{trailing}</span>}
      </div>
    );
  }
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, compact ? "h-8" : "h-9", className)} onWheel={wheel} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, "min-h-[84px] resize-y py-2 leading-relaxed", className)}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(control, "h-9 cursor-pointer appearance-none pr-8", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    );
  },
);
