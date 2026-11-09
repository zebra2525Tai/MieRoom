import Link from "next/link";
import type { ComponentProps } from "react";

// Disabled colors are set per variant (readable, about 5:1) instead of fading the
// whole button. Disabled primary/navy use a neutral grey fill and label (about
// 4.9:1), so they read as off and never outrank an enabled button next to them.
// "disabled:" wins over "hover:" in Tailwind's order, so a disabled button does not
// react to hover. LinkButton is never disabled.
const VARIANTS = {
  default:
    "border-line bg-white hover:border-[#8a96ad] hover:bg-[#f6f8fc] disabled:border-line disabled:bg-[#f6f8fc] disabled:text-muted",
  primary:
    "border-action bg-action text-white hover:border-brand hover:bg-brand disabled:border-line disabled:bg-[#f1f3f7] disabled:text-[#5f6b7f]",
  navy: "border-navy bg-navy text-white disabled:border-line disabled:bg-[#f1f3f7] disabled:text-[#5f6b7f]",
  subtle:
    "border-transparent bg-transparent text-brand-dark disabled:text-muted",
  danger:
    "border-[#8a96ad] bg-white text-red-ink disabled:border-line disabled:bg-[#f6f8fc] disabled:text-muted",
} as const;

// sm is at least 40px tall on phones and tablets (touch target), compact from lg up.
const SIZES = {
  md: "px-3.5 py-2.5 text-xs",
  sm: "min-h-10 px-2.5 py-1.5 text-[11px] lg:min-h-0",
  lg: "h-12 w-full px-4 text-[13px]",
} as const;

type Variant = keyof typeof VARIANTS;
type Size = keyof typeof SIZES;

function buttonClass(variant: Variant, size: Size, extra = ""): string {
  return `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-semibold leading-normal transition-colors disabled:opacity-100 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

type StyleProps = { variant?: Variant; size?: Size };

export function Button({
  variant = "default",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & StyleProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
}

export function LinkButton({
  variant = "default",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
