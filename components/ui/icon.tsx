import type { ReactNode } from "react";

// The prototype's line icons. Decorative: the text beside them carries the meaning.
const PATHS = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
  rooms: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2" />
    </>
  ),
  teachers: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  pin: (
    <>
      <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10h.01" />
    </>
  ),
  upload: (
    <path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
  ),
  download: (
    <path d="M12 3v13m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
  ),
  file: (
    <>
      <path d="M13 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8Z" />
      <path d="M13 2v6h7M8 13h8m-8 4h6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="8" cy="7" r="3" fill="currentColor" />
      <circle cx="16" cy="17" r="3" fill="currentColor" />
    </>
  ),
  logout: <path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  check: <path d="m5 12 4 4L19 6" />,
  door: (
    <>
      <path d="M5 21V3h14v18M3 21h18M15 12h.01" />
      <path d="M8 21V6h8v15" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18m-12 0v10m6-10v10" />
    </>
  ),
  edit: <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15Z" />,
  shield: (
    <>
      <path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m6 6 12 12" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6m-3-4v4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}
