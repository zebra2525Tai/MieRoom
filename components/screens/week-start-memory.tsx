"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// 週の始まり (S03): the choice is kept in this browser only, never on the server, like
// 自分のクラス. It travels in the URL (?start=sun) so the page is rendered on the server
// with it. The switch links always carry start=mon or start=sun, and that is what is
// remembered; the other links carry start=sun only while Sunday is chosen.

const STORAGE_KEY = "mieroom.weekStart";

/** Renders nothing. Remembers the choice, and brings Sunday back on a later visit. */
export function WeekStartMemory() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const chosen = params.get("start");
    try {
      if (chosen === "sun" || chosen === "mon") {
        localStorage.setItem(STORAGE_KEY, chosen);
        return;
      }
      if (localStorage.getItem(STORAGE_KEY) !== "sun") return;
    } catch {
      // Storage can be blocked: the choice then lasts for this visit through the URL.
      return;
    }
    const next = new URLSearchParams(params);
    next.set("start", "sun");
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  return null;
}
