import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "ミエルーム",
  description: "教室の使用状況と授業の予定を、見える化・予約できるシステム",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page is rendered per request: the Content-Security-Policy nonce
  // (set in proxy.ts) is different each time, so nothing can be prerendered.
  await connection();

  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
