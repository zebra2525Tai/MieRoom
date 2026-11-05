import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

// Small building blocks of every screen. Looks only: no data, no rules.

const BADGE_KINDS = {
  available: "bg-[#e0f2ee] text-[#00695c]",
  busy: "bg-[#e8ecff] text-[#1e36d6]",
  warning: "bg-amber-soft text-amber-ink",
  neutral: "bg-[#edf0f5] text-[#4a576c]",
  error: "bg-red-soft text-red-ink",
} as const;

export type BadgeKind = keyof typeof BADGE_KINDS;

export function Badge({
  kind = "neutral",
  children,
}: {
  kind?: BadgeKind;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[5px] px-1.5 py-1 text-[11px] font-semibold leading-tight ${BADGE_KINDS[kind]}`}
    >
      {children}
    </span>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`rounded-card border border-line bg-white shadow-card ${className}`}
      {...props}
    />
  );
}

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-3 md:flex-row md:gap-5">
      <div>
        <h1 className="text-2xl font-bold leading-snug sm:text-[27px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-xs text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}

const CALLOUT_KINDS = {
  info: "bg-[#e8ecff] text-[#3a4fc9]",
  warning: "bg-[#fff1d6] text-[#7a4400]",
  neutral: "bg-[#edf0f5] text-[#4a576c]",
  error: "bg-red-soft text-red-ink",
} as const;

export function Callout({
  kind = "info",
  icon = "info",
  children,
  className = "mb-5",
}: {
  kind?: keyof typeof CALLOUT_KINDS;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-[9px] px-4 py-3 text-xs ${CALLOUT_KINDS[kind]} ${className}`}
    >
      <Icon name={icon} size={17} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#8a96ad] bg-white px-5 py-12 text-center text-muted">
      <Icon name="search" size={28} className="mx-auto" />
      <h3 className="mb-1 mt-2 font-bold text-[#4a576c]">{title}</h3>
      {children && <p className="text-xs">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionHead({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3.5 mt-6 flex items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[11px] text-muted">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

export function FilterBar({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-2.5 rounded-[11px] border border-line bg-white p-3 sm:p-4 ${className}`}
      {...props}
    />
  );
}

export type SegmentItem = { label: string; href: string; active: boolean };

export function Segmented({
  items,
  label,
}: {
  items: SegmentItem[];
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="inline-flex gap-0.5 rounded-[7px] bg-[#edf0f5] p-[3px]"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={`rounded-[5px] px-3 py-1.5 text-[11px] ${
            item.active
              ? "bg-white font-bold text-navy shadow-[0_1px_4px_#14246b14]"
              : "text-[#586579]"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Tabs({
  items,
  label,
}: {
  items: SegmentItem[];
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="mb-5 flex gap-6 overflow-auto whitespace-nowrap border-b border-line"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`-mb-px border-b-2 px-0.5 py-3 text-xs ${
            item.active
              ? "border-brand font-bold text-brand-dark"
              : "border-transparent text-[#586579]"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-auto rounded-[11px] border border-line bg-white">
      <table className="w-full border-collapse whitespace-nowrap text-xs [&_tbody_tr:last-child_td]:border-b-0">
        {children}
      </table>
    </div>
  );
}

export function Th({
  className = "",
  highlight = false,
  ...props
}: ComponentProps<"th"> & { highlight?: boolean }) {
  const colors = highlight
    ? "bg-[#e8ecff] text-brand-dark"
    : "bg-[#f6f8fc] text-[#586579]";
  return (
    <th
      className={`border-b border-line px-4 py-3 text-left text-[11px] font-semibold ${colors} ${className}`}
      {...props}
    />
  );
}

export function Td({ className = "", ...props }: ComponentProps<"td">) {
  return (
    <td
      className={`border-b border-[#d5dae6] px-4 py-3.5 align-middle ${className}`}
      {...props}
    />
  );
}

export function SubText({ children }: { children: ReactNode }) {
  return (
    <span className="mt-0.5 block text-[11px] text-muted">{children}</span>
  );
}

export function Footnote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#586579]">
      <Icon name="info" size={13} />
      {children}
    </p>
  );
}

/** Shown where the screen is laid out but its saving is not built yet. */
export function NotReadyNotice({ children }: { children: ReactNode }) {
  return (
    <Callout kind="neutral">
      <strong className="font-semibold">まだ保存はできません。</strong>{" "}
      {children}
    </Callout>
  );
}
