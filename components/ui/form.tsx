import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./icon";

// Text is 16px below sm: iPhone Safari zooms into any focused control under 16px.
// Rule: never override a property these classes already set (bg, text color, padding)
// through className; the CSS order, not the class order, would decide. Use the
// dedicated classes below instead (readOnlyFieldClass, selectClass, ...).

export const fieldClass =
  "h-[41px] w-full rounded-[7px] border border-[#6f7b91] bg-white px-3 text-base font-normal text-ink disabled:cursor-not-allowed disabled:bg-[#f6f8fc] disabled:text-muted sm:text-xs";

export const filterFieldClass =
  "h-[38px] max-w-full rounded-lg border border-line bg-white px-2.5 text-base text-[#4a576c] disabled:cursor-not-allowed disabled:bg-[#f6f8fc] sm:text-xs";

export const textareaClass =
  "min-h-[92px] w-full resize-y rounded-[7px] border border-[#6f7b91] bg-white px-3 py-2.5 text-base font-normal text-ink sm:text-xs";

/** A value shown in a form that the user cannot change (申請者, クラス). Use with readOnly; it stays in the tab order, as read-only inputs normally do. */
export const readOnlyFieldClass =
  "flex h-[41px] w-full cursor-default items-center rounded-[7px] border border-line bg-[#edf0f5] px-3 text-base font-normal text-[#4a576c] sm:text-xs";

/** <select> in a form: fieldClass with a light chevron instead of the native arrow. */
export const selectClass = `${fieldClass} select-chevron pr-9`;

/** <select> in a filter bar: filterFieldClass with the same chevron. */
export const filterSelectClass = `${filterFieldClass} select-chevron pr-8 [--chevron-inset:10px]`;

/**
 * The checked look of a checkbox card (a <label> around a checkbox): S12 枠 and S14 講師
 * use the same one. Add it to the label's own classes.
 */
export const choiceCheckedClass =
  "has-checked:border-brand has-checked:bg-[#f3f5ff] has-checked:ring-1 has-checked:ring-inset has-checked:ring-brand";

/** Search box with a leading icon (see SearchField). */
export const searchFieldClass =
  "h-[38px] w-full rounded-lg border border-line bg-white pl-9 pr-3 text-base text-ink sm:text-xs";

/** A search input with the search icon inside it. Pass name, aria-label, placeholder and so on. */
export function SearchField({
  className = "",
  ...props
}: ComponentProps<"input">) {
  return (
    <div className={`relative ${className}`}>
      <Icon
        name="search"
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#586579]"
      />
      <input className={searchFieldClass} {...props} />
    </div>
  );
}

export function Field({
  label,
  required = false,
  help,
  error,
  full = false,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex min-w-0 flex-col gap-1.5 text-xs font-semibold ${full ? "sm:col-span-2" : ""}`}
    >
      <span>
        {label}
        {required && (
          <span className="ml-1.5 text-[11px] text-[#a3101f]">必須</span>
        )}
      </span>
      {children}
      {help && (
        <span className="text-[11px] font-normal text-muted">{help}</span>
      )}
      {error && (
        <span role="alert" className="text-[11px] font-normal text-red-ink">
          {error}
        </span>
      )}
    </label>
  );
}

/**
 * The submit row at the end of a form: right-aligned from sm, full-width buttons
 * stacked on phones. Put the main action last: it is rightmost from sm and on top on phones.
 */
export function FormActions({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col-reverse gap-2 *:w-full sm:flex-row sm:justify-end sm:*:w-auto ${className}`}
    >
      {children}
    </div>
  );
}
