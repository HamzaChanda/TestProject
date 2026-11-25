"use client";

/**
 * DatePicker — value is a "yyyy-MM-dd" string (same contract as the native input it replaces).
 * Presets: Today / Yesterday. Keyboard in the grid: arrows ±1 day / ±1 week, Home/End week,
 * PageUp/PageDown month, Enter selects, Esc closes.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePopover } from "@/hooks/usePopover";
import { controlClass } from "./Field";

const ISO = "yyyy-MM-dd";
const WEEK = { weekStartsOn: 1 as const };

export function DatePicker({
  value,
  onChange,
  min,
  max,
  id,
  ariaLabel,
  invalid,
  size = "md",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  id?: string;
  ariaLabel?: string;
  invalid?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const gridId = useId();
  const { open, setOpen, anchorRef, panelRef, pos, mounted, closing } = usePopover({ width: 288 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const parsed = value ? parseISO(value) : null;
  const current = parsed && isValid(parsed) ? parsed : null;
  const [focus, setFocus] = useState<Date>(current ?? new Date());
  const minD = min ? startOfDay(parseISO(min)) : null;
  const maxD = max ? startOfDay(parseISO(max)) : null;
  const outOfRange = (d: Date) => (minD && isBefore(d, minD)) || (maxD && isAfter(d, maxD));

  useEffect(() => {
    if (!open) return;
    setFocus(current ?? new Date());
    const t = window.setTimeout(() => gridRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [open]);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(focus), WEEK), end: endOfWeek(endOfMonth(focus), WEEK) }),
    [focus],
  );

  const pick = (d: Date) => {
    if (outOfRange(d)) return;
    onChange(format(d, ISO));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onGridKey = (e: KeyboardEvent) => {
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => startOfWeek(focus, WEEK),
      End: () => endOfWeek(focus, WEEK),
      PageUp: () => addMonths(focus, -1),
      PageDown: () => addMonths(focus, 1),
    };
    if (map[e.key]) {
      e.preventDefault();
      setFocus(map[e.key]());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(focus);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const today = startOfDay(new Date());
  const presets = [
    { label: "Today", date: today },
    { label: "Yesterday", date: subDays(today, 1) },
  ];

  return (
    <div ref={anchorRef} className={cn("relative min-w-0", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${current ? format(current, "d MMMM yyyy") : "not set"}` : undefined}
        data-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(controlClass, "flex items-center gap-2 pr-2.5 text-left", size === "sm" ? "h-8 text-body-sm" : "h-9")}
      >
        <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
        <span className={cn("flex-1 truncate tabular", !current && "text-faint")}>{current ? format(current, "d MMM yyyy") : "Select date"}</span>
      </button>

      {mounted &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose date"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: 288 }}
            className={cn("fixed z-[85] rounded-panel border border-line bg-surface p-3 shadow-pop", closing ? "pointer-events-none animate-pop-out" : "animate-pop-in")}
            inert={closing}
          >
            <div className="mb-2 flex gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={!!outOfRange(p.date)}
                  onClick={() => pick(p.date)}
                  className={cn(
                    "h-7 rounded-control border px-2.5 text-label font-medium transition-colors disabled:opacity-40",
                    current && isSameDay(current, p.date) ? "border-petrol-100 bg-petrol-50 text-petrol-700" : "border-line-strong text-ink-2 hover:bg-subtle",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mb-1 flex items-center justify-between">
              <button type="button" onClick={() => setFocus(addMonths(focus, -1))} className="grid size-7 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink" aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-body-sm font-semibold text-ink" aria-live="polite">
                {format(focus, "MMMM yyyy")}
              </span>
              <button type="button" onClick={() => setFocus(addMonths(focus, 1))} className="grid size-7 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink" aria-label="Next month">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 text-center font-cond text-overline font-semibold tracking-[0.06em] text-muted uppercase" aria-hidden>
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div
              ref={gridRef}
              id={gridId}
              role="grid"
              tabIndex={0}
              aria-activedescendant={`${gridId}-${format(focus, ISO)}`}
              aria-label={format(focus, "MMMM yyyy")}
              onKeyDown={onGridKey}
              className="grid grid-cols-7 gap-0.5 rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol-500/30"
            >
              {days.map((d) => {
                const disabled = !!outOfRange(d);
                const sel = current && isSameDay(d, current);
                const foc = isSameDay(d, focus);
                return (
                  <button
                    key={d.toISOString()}
                    id={`${gridId}-${format(d, ISO)}`}
                    type="button"
                    role="gridcell"
                    tabIndex={-1}
                    aria-selected={sel || undefined}
                    aria-label={format(d, "EEEE d MMMM yyyy")}
                    disabled={disabled}
                    onClick={() => pick(d)}
                    className={cn(
                      "grid h-8 place-items-center rounded-control text-body-sm tabular transition-colors",
                      !isSameMonth(d, focus) && "text-faint",
                      isSameMonth(d, focus) && !sel && "text-ink-2 hover:bg-hover",
                      isSameDay(d, today) && !sel && "font-semibold text-petrol-700",
                      sel && "bg-petrol-500 font-semibold text-white",
                      foc && !sel && "ring-1 ring-petrol-500 ring-inset",
                      disabled && "cursor-not-allowed opacity-35 hover:bg-transparent",
                    )}
                  >
                    {format(d, "d")}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
