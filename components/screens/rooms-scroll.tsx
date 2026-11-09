"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * S04 時限表: when the table is wider than the screen, it opens scrolled sideways so
 * that the chosen period (the header cells marked data-selected) sits right after the
 * sticky 教室 column. Only the table box scrolls, never the page, and nothing moves
 * when the chosen period is already in view. Looks only.
 */
export function ScrollToSelectedColumn({
  selected,
  children,
}: {
  /** Scrolls again when this changes (the chosen period). */
  selected: string | number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const marked = ref.current?.querySelectorAll<HTMLElement>(
      "thead [data-selected]",
    );
    if (!marked || marked.length === 0) return;
    const first = marked[0];
    const last = marked[marked.length - 1];
    const box = first.closest("table")?.parentElement;
    if (!box || box.scrollWidth <= box.clientWidth) return;

    const boxRect = box.getBoundingClientRect();
    // The sticky first column covers the left part of the box.
    const stickyRight =
      first.parentElement?.firstElementChild?.getBoundingClientRect().right ??
      boxRect.left;
    const firstRect = first.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    if (firstRect.left >= stickyRight && lastRect.right <= boxRect.right) {
      return;
    }
    box.scrollLeft += firstRect.left - stickyRight;
  }, [selected]);

  return <div ref={ref}>{children}</div>;
}
