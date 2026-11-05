import { slotsOfPeriod, type PeriodNo, type SlotNo } from "./periods";

// 枠の状態 (外部設計書 R4-1) and the S04 filter. No I/O here.

export type SlotStatus =
  | { kind: "free" }
  | { kind: "pending" }
  | { kind: "reserved" }
  | { kind: "lesson"; className: string }
  | { kind: "blocked" };

export type RoomKind = "HOMEROOM" | "FREE";

export type RoomRow = {
  id: string;
  name: string;
  building: string | null;
  kind: RoomKind;
  note: string | null;
  slots: Record<SlotNo, SlotStatus>;
};

export const ALL_FREE: Record<SlotNo, SlotStatus> = {
  1: { kind: "free" },
  2: { kind: "free" },
  3: { kind: "free" },
  4: { kind: "free" },
  5: { kind: "free" },
  6: { kind: "free" },
  7: { kind: "free" },
  8: { kind: "free" },
};

export function slotStatusLabel(status: SlotStatus): string {
  switch (status.kind) {
    case "free":
      return "空き";
    case "pending":
      return "仮予約あり";
    case "reserved":
      return "予約済み";
    case "lesson":
      return `授業(${status.className})`;
    case "blocked":
      return "使用止め";
  }
}

export type RoomFilter = {
  periodNo: PeriodNo;
  onlyFree: boolean;
  kind: RoomKind | null;
  building: string | null;
};

function isOpen(status: SlotStatus): boolean {
  return status.kind === "free" || status.kind === "pending";
}

/** 「空きだけ」: the first or second half of the period is 空き or 仮予約あり (S04). */
export function filterRooms(
  rooms: readonly RoomRow[],
  filter: RoomFilter,
): RoomRow[] {
  const [first, second] = slotsOfPeriod(filter.periodNo);
  return rooms.filter((room) => {
    if (filter.kind && room.kind !== filter.kind) return false;
    if (filter.building && room.building !== filter.building) return false;
    if (!filter.onlyFree) return true;
    return isOpen(room.slots[first.no]) || isOpen(room.slots[second.no]);
  });
}
