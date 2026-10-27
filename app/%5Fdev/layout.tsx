import { notFound } from "next/navigation";

// /_dev/ pages work without login, so they must never be enabled in production.
// The folder is named %5Fdev because a plain _dev folder is private (not routed).
export default function DevLayout({ children }: LayoutProps<"/_dev">) {
  if (process.env.ENABLE_DEV_PAGES !== "true") {
    notFound();
  }
  return children;
}
