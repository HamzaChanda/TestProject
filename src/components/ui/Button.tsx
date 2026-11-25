import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stock Ledger buttons.
 * - primary: the ONE filled action per viewport (petrol).
 * - secondary: outlined; header "New", exports, filters.
 * - ghost: toolbars, icon buttons, Cancel.
 * - danger: only inside confirmation dialogs.
 * - subtle: petrol tint for inline row actions.
 * - link: inline navigation.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium select-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-[120ms] ease-[var(--ease-standard)] " +
  "active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
  "disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-petrol-500 text-white hover:bg-petrol-600 active:bg-petrol-700",
  secondary: "border border-line-strong bg-surface text-ink shadow-xs hover:border-control hover:bg-subtle active:bg-sunken",
  ghost: "text-ink-2 hover:bg-hover hover:text-ink active:bg-pressed",
  danger: "bg-danger-solid text-white hover:bg-[#b42318] active:bg-[#912018]",
  subtle: "bg-petrol-50 text-petrol-700 hover:bg-petrol-100",
  link: "h-auto px-0 text-petrol-500 underline-offset-4 hover:underline active:translate-y-0",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-label",
  sm: "h-7 px-2.5 text-label",
  md: "h-8 px-3 text-body",
  lg: "h-11 px-4 text-body",
  icon: "h-8 w-8",
  "icon-sm": "h-7 w-7",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], variant !== "link" && sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function ButtonLink({ variant = "primary", size = "md", icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
