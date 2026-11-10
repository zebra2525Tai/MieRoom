import type { TestRole } from "./fixtures";

// The sign-in is replaced in the integration tests (the real Microsoft sign-in is checked by
// hand; テスト設計書 2章). The role rule is the app's: student < teacher < admin.

const RANK: Record<TestRole, number> = { student: 0, teacher: 1, admin: 2 };

export const hasRole = (user: { role: TestRole }, role: TestRole): boolean =>
  RANK[user.role] >= RANK[role];
