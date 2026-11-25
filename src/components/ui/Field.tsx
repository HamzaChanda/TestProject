import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-control border border-line-strong bg-surface px-3 text-ui text-ink placeholder:text-faint shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-[border,box-shadow] duration-150 hover:border-line-hover focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

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
          <label htmlFor={htmlFor} className="text-small font-medium text-ink-2">
            {label}
            {required && <span className="ml-0.5 text-danger">*</span>}
          </label>
          {aside}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-small text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leading, trailing, onWheel, ...props },
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
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body text-muted">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(control, "h-9", leading && (String(leading).length > 1 ? "pl-12" : "pl-8"), trailing && "pr-10", className)}
          onWheel={wheel}
          {...props}
        />
        {trailing && <span className="absolute inset-y-0 right-3 flex items-center text-small text-muted">{trailing}</span>}
      </div>
    );
  }
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, "h-9", className)} onWheel={wheel} {...props} />;
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
