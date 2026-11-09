import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

// Small building blocks of every screen. Looks only: no data, no rules.
// Rule: do not override a property a part already sets (bg, text color, white-space,
// text-align) through className; the CSS order would decide, not the class order.
// Use the props instead (Badge wrap, Th/Td numeric and stickyLeft, ...).

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
  wrap = false,
  className = "",
  children,
}: {
  kind?: BadgeKind;
  /** Let a long badge wrap inside a narrow cell instead of widening it. */
  wrap?: boolean;
  /** Spacing or layout only (margins, self-alignment). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[5px] px-1.5 py-1 text-[11px] font-semibold leading-tight ${wrap ? "whitespace-normal" : "whitespace-nowrap"} ${BADGE_KINDS[kind]} ${className}`}
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
  // Side by side only from lg: at tablet width the title, a long description and
  // two or three buttons do not fit on one row.
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-3 lg:flex-row lg:gap-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-snug sm:text-[27px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-xs text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

const CALLOUT_KINDS = {
  info: "bg-[#e8ecff] text-[#3a4fc9]",
  success: "bg-[#e0f2ee] text-[#00695c]",
  warning: "bg-[#fff1d6] text-[#7a4400]",
  neutral: "bg-[#edf0f5] text-[#4a576c]",
  error: "bg-red-soft text-red-ink",
} as const;

export type CalloutKind = keyof typeof CALLOUT_KINDS;

export function Callout({
  kind = "info",
  icon = "info",
  children,
  className = "mb-5",
}: {
  kind?: CalloutKind;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-[9px] px-4 py-3 text-xs ${CALLOUT_KINDS[kind]} ${className}`}
    >
      <Icon name={icon} size={17} className="mt-px" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  icon = "search",
  children,
  action,
}: {
  title: string;
  /** "search" (the default) reads as "no results"; pass another icon where nothing was searched. */
  icon?: IconName;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#8a96ad] bg-white px-5 py-12 text-center text-muted">
      <Icon name={icon} size={28} className="mx-auto" />
      <h3 className="mb-1 mt-2 font-bold text-[#4a576c]">{title}</h3>
      {children && (
        <p className="mx-auto max-w-prose text-balance text-xs">{children}</p>
      )}
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
      <div className="min-w-0">
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
  stretch = false,
}: {
  items: SegmentItem[];
  label: string;
  /** Full width with equal segments on phones (below sm). */
  stretch?: boolean;
}) {
  // Segments are at least 40px tall and 44px wide on phones and tablets (touch targets).
  return (
    <nav
      aria-label={label}
      className={`gap-0.5 rounded-[7px] bg-[#edf0f5] p-[3px] ${stretch ? "flex w-full sm:inline-flex sm:w-auto" : "inline-flex"}`}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={`inline-flex min-h-10 min-w-11 items-center justify-center whitespace-nowrap rounded-[5px] px-3 py-1.5 text-xs sm:text-[11px] lg:min-h-0 lg:min-w-0 ${
            stretch ? "flex-1 sm:flex-none" : ""
          } ${
            item.active
              ? "bg-white font-bold text-navy shadow-[0_1px_4px_#14246b14]"
              : "text-[#586579] hover:text-navy"
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
  // The focus ring is drawn inside the tab: the strip scrolls and would clip it.
  return (
    <nav
      aria-label={label}
      className="mb-5 flex gap-4 overflow-auto whitespace-nowrap border-b border-line"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`-mb-px border-b-2 px-2 py-3 text-xs focus-visible:-outline-offset-3 ${
            item.active
              ? "border-brand font-bold text-brand-dark"
              : "border-transparent text-[#586579] hover:text-navy"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * A table that scrolls sideways when it is wider than the screen. A soft shadow on the
 * left or right edge shows that more columns are hidden there (CSS only, see
 * scroll-shadow-x in globals.css). Cells must stay transparent for the shadow to show,
 * except header cells and sticky cells (use stickyLeft).
 */
export function TableWrap({
  children,
  className = "",
  tableClassName = "",
}: {
  children: ReactNode;
  /** The scrolling box, e.g. "max-w-3xl" for short key/value tables. */
  className?: string;
  /** The <table>, e.g. "table-fixed" together with a <colgroup>. */
  tableClassName?: string;
}) {
  return (
    <div
      className={`scroll-shadow-x overflow-auto rounded-[11px] border border-line ${className}`}
    >
      <table
        className={`w-full border-separate border-spacing-0 whitespace-nowrap text-xs [&_tbody_tr:last-child_td]:border-b-0 ${tableClassName}`}
      >
        {children}
      </table>
    </div>
  );
}

// The first column stays in place while the table scrolls sideways. The edge is a
// shadow, not a border. TableWrap uses the separate border model (spacing 0), since
// box-shadow is not painted on cells of a border-collapse table.
const STICKY_LEFT =
  "sticky left-0 z-10 shadow-[1px_0_0_#d5dae6,6px_0_8px_-6px_#14246b33]";

export function Th({
  className = "",
  highlight = false,
  numeric = false,
  stickyLeft = false,
  dense = false,
  ...props
}: ComponentProps<"th"> & {
  highlight?: boolean;
  /** Right-aligned, tabular figures (counts, years). */
  numeric?: boolean;
  /** The first column stays visible while the table scrolls sideways. */
  stickyLeft?: boolean;
  /** Narrower side padding (px-2.5) for tables with many equal columns. */
  dense?: boolean;
}) {
  // Translucent fills look the same on white (#f6f8fc / #e8ecff) and let the
  // TableWrap edge shadow show through. A sticky cell must cover what scrolls under
  // it, so it keeps an opaque fill.
  const colors = highlight
    ? `${stickyLeft ? "bg-[#e8ecff]" : "bg-[#3a4fc9]/[0.12]"} text-brand-dark`
    : `${stickyLeft ? "bg-[#f6f8fc]" : "bg-[#14246b]/[0.035]"} text-[#586579]`;
  return (
    <th
      className={`border-b border-line ${dense ? "px-2.5" : "px-4"} py-3 text-[11px] font-semibold ${numeric ? "text-right tabular-nums" : "text-left"} ${stickyLeft ? STICKY_LEFT : ""} ${colors} ${className}`}
      {...props}
    />
  );
}

export function Td({
  className = "",
  numeric = false,
  stickyLeft = false,
  dense = false,
  ...props
}: ComponentProps<"td"> & {
  /** Right-aligned, tabular figures (counts, years). */
  numeric?: boolean;
  /** The first column stays visible while the table scrolls sideways (white background). */
  stickyLeft?: boolean;
  /** Narrower side padding (px-2.5) for tables with many equal columns. */
  dense?: boolean;
}) {
  return (
    <td
      className={`border-b border-[#d5dae6] ${dense ? "px-2.5" : "px-4"} py-3.5 align-middle ${numeric ? "text-right tabular-nums" : ""} ${stickyLeft ? `${STICKY_LEFT} bg-white` : ""} ${className}`}
      {...props}
    />
  );
}

/** IDs and codes (受信機ID, タグID): monospace, and allowed to break anywhere. */
export const monoTextClass = "font-mono text-[11px] break-all";

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
