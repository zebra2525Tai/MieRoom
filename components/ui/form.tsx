import type { ReactNode } from "react";

export const fieldClass =
  "h-[41px] w-full rounded-[7px] border border-[#6f7b91] bg-white px-3 text-xs font-normal text-ink";

export const filterFieldClass =
  "h-[38px] max-w-full rounded-lg border border-line bg-white px-2.5 text-xs text-[#4a576c]";

export const textareaClass =
  "min-h-[92px] w-full resize-y rounded-[7px] border border-[#6f7b91] bg-white px-3 py-2.5 text-xs font-normal text-ink";

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
      className={`flex flex-col gap-1.5 text-xs font-semibold ${full ? "sm:col-span-2" : ""}`}
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
