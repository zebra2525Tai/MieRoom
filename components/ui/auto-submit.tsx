"use client";

import type { ComponentProps } from "react";
import { filterFieldClass, filterSelectClass } from "./form";

// Filters are plain GET forms. These submit as soon as a value is chosen, so a filter
// needs no separate button; a <noscript> button covers browsers without JavaScript.

export function AutoSubmitSelect({
  className = filterSelectClass,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      className={className}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      {...props}
    />
  );
}

export function AutoSubmitInput({
  className = filterFieldClass,
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      className={className}
      onChange={(event) => {
        if (event.currentTarget.value !== "") {
          event.currentTarget.form?.requestSubmit();
        }
      }}
      {...props}
    />
  );
}
