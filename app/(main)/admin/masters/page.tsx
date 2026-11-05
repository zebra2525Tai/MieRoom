import { redirect } from "next/navigation";

// S21 マスタ opens on the first tab. The tab page checks the role.
export default function MastersIndexPage() {
  redirect("/admin/masters/classes");
}
