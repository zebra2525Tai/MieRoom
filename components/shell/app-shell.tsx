"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOutAction } from "@/app/login/actions";
import type { Role } from "@/lib/auth/policy";
import {
  activeItem,
  itemById,
  menuFor,
  ROLE_LABEL,
  type NavItem,
} from "@/lib/nav";
import { Icon } from "@/components/ui/icon";
import { Brand } from "./brand";

// 共通のレイアウト (外部設計書 5-2). The name of the person is not shown after login.
// The role only decides what is offered here; pages check it again on the server.
export function AppShell({
  role,
  todayText,
  sampleScreenId,
  children,
}: {
  role: Role;
  todayText: string;
  /** Only on the /_dev sample pages: which screen is open. The menu stays inside /_dev. */
  sampleScreenId?: string;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const sections = menuFor(role);
  const current: NavItem | null = sampleScreenId
    ? itemById(sampleScreenId)
    : activeItem(pathname);
  const currentSection = sections.find((section) =>
    section.items.some((item) => item.id === current?.id),
  );

  return (
    <div className="min-h-screen sm:grid sm:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[230px_minmax(0,1fr)] print:block">
      {menuOpen && (
        <button
          type="button"
          aria-label="メニューを閉じる"
          className="fixed inset-0 z-30 bg-[#14246b55] sm:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        aria-label="メインメニュー"
        className={`fixed inset-y-0 left-0 z-40 flex w-[245px] flex-col overflow-y-auto border-r border-line bg-white px-3 pb-5 pt-6 transition-transform sm:sticky sm:top-0 sm:h-screen sm:w-auto sm:translate-x-0 sm:shadow-none lg:px-4 print:hidden ${
          menuOpen
            ? "translate-x-0 shadow-[10px_0_50px_#14246b24]"
            : "-translate-x-full"
        }`}
      >
        <div className="px-2 pb-6">
          <Brand />
        </div>
        <nav className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="mx-3 mb-1.5 text-[11px] font-bold tracking-widest text-[#667389]">
                {section.label}
              </div>
              {section.items.map((item) => {
                const active = item.id === current?.id;
                return (
                  <Link
                    key={item.id}
                    href={
                      sampleScreenId
                        ? `/_dev/${item.id}?role=${role}`
                        : item.href
                    }
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`my-0.5 flex items-center gap-3 rounded-[9px] px-3 py-2.5 font-medium transition-colors hover:bg-[#f0f3fa] hover:text-navy ${
                      active
                        ? "bg-[#e8ecff] font-bold text-brand-dark"
                        : "text-[#4a576c]"
                    }`}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-line bg-white px-4 sm:h-20 sm:px-8 print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="メニューを開く"
              aria-expanded={menuOpen}
              className="inline-flex rounded-lg border border-line bg-white p-1.5 sm:hidden"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <div className="text-xs text-[#586579]">
              {currentSection?.label ?? "ミエルーム"}
              {current && (
                <span className="ml-2 text-[#4a576c]">/ {current.label}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-xs font-semibold sm:block">
              {todayText}
            </div>
            <div className="flex items-center gap-2 border-l border-line pl-3">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#e8ecff] text-xs font-bold text-navy sm:h-[34px] sm:w-[34px]">
                {ROLE_LABEL[role][0]}
              </span>
              <span className="hidden text-xs md:block">
                {ROLE_LABEL[role]}
              </span>
            </div>
            {!sampleScreenId && (
              <form action={signOutAction}>
                <button
                  type="submit"
                  aria-label="ログアウト"
                  title="ログアウト"
                  className="inline-flex rounded-lg border border-line bg-white p-1.5 hover:bg-[#f6f8fc]"
                >
                  <Icon name="logout" />
                </button>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1490px] px-4 pb-10 pt-6 sm:px-8 sm:pt-8 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
