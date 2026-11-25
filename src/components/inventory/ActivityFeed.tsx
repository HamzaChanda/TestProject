"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  Ban,
  Building2,
  CircleDollarSign,
  PackageCheck,
  PackagePlus,
  PackageX,
  Pencil,
  ReceiptText,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  UserPlus,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { Activity, ActivityType } from "@/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

const META: Record<ActivityType, { icon: LucideIcon; tone: string }> = {
  sale_created: { icon: ReceiptText, tone: "bg-brand-50 text-brand" },
  sale_completed: { icon: CheckCircle2, tone: "bg-success-bg text-success" },
  sale_cancelled: { icon: Ban, tone: "bg-danger-bg text-danger" },
  payment_recorded: { icon: CircleDollarSign, tone: "bg-success-bg text-success" },
  purchase_created: { icon: ShoppingCart, tone: "bg-[#fff1ea] text-[#c2410c]" },
  purchase_received: { icon: PackageCheck, tone: "bg-success-bg text-success" },
  purchase_cancelled: { icon: Ban, tone: "bg-[#f2f3f6] text-muted" },
  product_added: { icon: PackagePlus, tone: "bg-info-bg text-info" },
  product_updated: { icon: Pencil, tone: "bg-[#f2f3f6] text-ink-2" },
  product_deleted: { icon: PackageX, tone: "bg-danger-bg text-danger" },
  stock_adjusted: { icon: SlidersHorizontal, tone: "bg-warning-bg text-warning" },
  transfer_created: { icon: ArrowLeftRight, tone: "bg-info-bg text-info" },
  transfer_completed: { icon: ArrowLeftRight, tone: "bg-info-bg text-info" },
  transfer_cancelled: { icon: ArrowLeftRight, tone: "bg-[#f2f3f6] text-muted" },
  customer_added: { icon: UserPlus, tone: "bg-brand-50 text-brand" },
  supplier_added: { icon: Building2, tone: "bg-[#fff1ea] text-[#c2410c]" },
  settings_updated: { icon: Settings, tone: "bg-[#f2f3f6] text-ink-2" },
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <ol className="relative">
      {activities.map((a, i) => {
        const meta = META[a.type] ?? META.settings_updated;
        const Icon = meta.icon;
        const body = (
          <>
            <span className={cn("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-surface", meta.tone)}>
              <Icon className="h-[15px] w-[15px]" />
            </span>
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-ink">{a.title}</span>
                <time className="shrink-0 text-[11.5px] text-faint" title={formatDateTime(a.date)} dateTime={a.date}>
                  {timeAgo(a.date)}
                </time>
              </div>
              <p className="truncate text-[12.5px] text-muted">{a.description}</p>
              {a.reference && (
                <span className="mt-1 inline-block rounded-[5px] bg-[#f2f3f6] px-1.5 py-px font-mono text-[11px] text-ink-2">{a.reference}</span>
              )}
            </div>
          </>
        );
        return (
          <li key={a.id} className="relative">
            {i < activities.length - 1 && <span className="absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 bg-line" />}
            {a.href ? (
              <Link href={a.href} className="-mx-2 flex gap-3 rounded-[10px] px-2 pt-1 transition-colors hover:bg-subtle">
                {body}
              </Link>
            ) : (
              <div className="flex gap-3 pt-1">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
