"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { filterSelectClass } from "@/components/ui/form";

// 自分のクラス (外部設計書 R6-1): kept in this browser with the school year it was
// chosen in, never on the server. The choice travels in the URL so the page can be
// rendered on the server for that class.

const STORAGE_KEY = "mieroom.myClass";

type Stored = { classId: string; fiscalYear: number };

function readStored(): Stored | null {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    if (
      typeof value === "object" &&
      value !== null &&
      "classId" in value &&
      "fiscalYear" in value &&
      typeof value.classId === "string" &&
      typeof value.fiscalYear === "number"
    ) {
      return { classId: value.classId, fiscalYear: value.fiscalYear };
    }
  } catch {
    // Storage can be blocked or hold something else: treated as not chosen.
  }
  return null;
}

function writeStored(value: Stored | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The choice still works for this visit through the URL.
  }
}

export type ClassOption = { id: string; name: string };

export function MyClassSelect({
  classes,
  selectedId,
  todayFiscalYear,
  emptyLabel,
}: {
  classes: ClassOption[];
  selectedId: string | null;
  todayFiscalYear: number;
  /** Text of the "nothing chosen" choice. Leave out when a class is always shown. */
  emptyLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("class") || params.get("teacher")) return;
    const stored = readStored();
    if (!stored) return;
    const next = new URLSearchParams(params);
    if (stored.fiscalYear !== todayFiscalYear) {
      writeStored(null);
      next.set("notice", "year-changed");
    } else if (classes.some((item) => item.id === stored.classId)) {
      next.set("class", stored.classId);
    } else {
      return;
    }
    router.replace(`${pathname}?${next.toString()}`);
  }, [classes, params, pathname, router, todayFiscalYear]);

  return (
    // One row at every width: full width on phones (the select takes the rest of the
    // row), a fixed 210px select from sm.
    <label className="flex w-full items-center gap-2 whitespace-nowrap text-xs text-muted sm:w-auto">
      自分のクラス
      <select
        className={`${filterSelectClass} min-w-0 flex-1 sm:w-[210px] sm:flex-none`}
        value={selectedId ?? ""}
        onChange={(event) => {
          const value = event.currentTarget.value;
          const next = new URLSearchParams(params);
          next.delete("notice");
          next.delete("teacher");
          if (value === "") {
            next.delete("class");
            writeStored(null);
          } else {
            next.set("class", value);
            writeStored({ classId: value, fiscalYear: todayFiscalYear });
          }
          router.push(`${pathname}?${next.toString()}`);
        }}
      >
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {classes.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
