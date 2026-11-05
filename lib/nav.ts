import type { Role } from "@/lib/auth/policy";

// メニュー (外部設計書 5-3). Showing an item is only a convenience: every page and
// every server function still checks the role on the server.

export const ROLE_LABEL: Record<Role, string> = {
  student: "学生",
  teacher: "先生",
  admin: "時間割管理者",
};

export type NavIcon =
  | "home"
  | "calendar"
  | "rooms"
  | "teachers"
  | "plus"
  | "file"
  | "check"
  | "edit"
  | "ban"
  | "upload"
  | "settings"
  | "grid"
  | "download"
  | "pin"
  | "trash"
  | "monitor";

export type NavItem = {
  /** S番号. Also the address of the sample page under /_dev. */
  id: string;
  label: string;
  href: string;
  icon: NavIcon;
  minRole: Role;
};

export type NavSection = { label: string; items: NavItem[] };

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "キャンパス",
    items: [
      {
        id: "s02",
        label: "ホーム",
        href: "/",
        icon: "home",
        minRole: "student",
      },
      {
        id: "s03",
        label: "時間割",
        href: "/timetable",
        icon: "calendar",
        minRole: "student",
      },
      {
        id: "s04",
        label: "空き教室",
        href: "/rooms",
        icon: "rooms",
        minRole: "student",
      },
      {
        id: "s05",
        label: "先生一覧",
        href: "/teachers",
        icon: "teachers",
        minRole: "student",
      },
      {
        id: "s06",
        label: "予約する",
        href: "/reservations/new",
        icon: "plus",
        minRole: "student",
      },
      {
        id: "s07",
        label: "自分の予約",
        href: "/reservations",
        icon: "file",
        minRole: "student",
      },
    ],
  },
  {
    label: "先生",
    items: [
      {
        id: "s10",
        label: "先生ホーム",
        href: "/teacher",
        icon: "check",
        minRole: "teacher",
      },
      {
        id: "s11",
        label: "予約の一覧",
        href: "/teacher/reservations",
        icon: "file",
        minRole: "teacher",
      },
      {
        id: "s12",
        label: "代理入力",
        href: "/teacher/reservations/new",
        icon: "edit",
        minRole: "teacher",
      },
      {
        id: "s13",
        label: "使用止め",
        href: "/teacher/blocks",
        icon: "ban",
        minRole: "teacher",
      },
    ],
  },
  {
    label: "管理",
    items: [
      {
        id: "s20",
        label: "取り込み",
        href: "/admin/import",
        icon: "upload",
        minRole: "admin",
      },
      {
        id: "s21",
        label: "マスタ",
        href: "/admin/masters",
        icon: "settings",
        minRole: "admin",
      },
      {
        id: "s22",
        label: "紐づけ",
        href: "/admin/links",
        icon: "grid",
        minRole: "admin",
      },
      {
        id: "s23",
        label: "休み・行事",
        href: "/admin/closures",
        icon: "calendar",
        minRole: "admin",
      },
      {
        id: "s24",
        label: "CSV書き出し",
        href: "/admin/export",
        icon: "download",
        minRole: "admin",
      },
      {
        id: "s25",
        label: "タグ・受信機",
        href: "/admin/access",
        icon: "pin",
        minRole: "admin",
      },
      {
        id: "s26",
        label: "削除管理",
        href: "/admin/delete",
        icon: "trash",
        minRole: "admin",
      },
      {
        id: "s27",
        label: "モニターURL",
        href: "/admin/monitors",
        icon: "monitor",
        minRole: "admin",
      },
    ],
  },
];

const RANK: Record<Role, number> = { student: 0, teacher: 1, admin: 2 };

export function menuFor(role: Role): NavSection[] {
  return SECTIONS.map((section) => ({
    label: section.label,
    items: section.items.filter((item) => RANK[role] >= RANK[item.minRole]),
  })).filter((section) => section.items.length > 0);
}

/** The menu item a path belongs to: the longest href that is a prefix of the path. */
export function activeItem(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of SECTIONS.flatMap((section) => section.items)) {
    const matches =
      item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

export function itemById(id: string): NavItem | null {
  return (
    SECTIONS.flatMap((section) => section.items).find(
      (item) => item.id === id,
    ) ?? null
  );
}
