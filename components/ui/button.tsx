import Link from "next/link";
import type { ComponentProps } from "react";

const VARIANTS = {
  default: "border-line bg-white hover:border-[#bdced8] hover:bg-[#f7f9fa]",
  primary: "border-teal bg-teal text-white hover:bg-teal-dark",
  navy: "border-navy bg-navy text-white",
  subtle: "border-transparent bg-transparent text-teal-dark",
  danger: "border-[#edcccc] bg-white text-red-ink",
} as const;

const SIZES = {
  md: "px-3.5 py-2.5 text-xs",
  sm: "px-2.5 py-1.5 text-[11px]",
  lg: "h-12 w-full px-4 text-[13px]",
} as const;

type Variant = keyof typeof VARIANTS;
type Size = keyof typeof SIZES;

function buttonClass(variant: Variant, size: Size, extra = ""): string {
  return `inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold leading-normal transition-colors ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
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
