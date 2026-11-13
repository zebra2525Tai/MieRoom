import type { RoomStates } from "@/lib/domain/floor-plan";

// S30 の見本 (架空のデータ)。教室の名前は、デモのマスタの教室。
export function monitorSampleStates(isNext: boolean): RoomStates {
  const lesson = (className: string, subject: string, teacher: string) =>
    ({ kind: "lesson", next: isNext, className, subject, teacher }) as const;
  return {
    "101": { kind: "free" },
    "201": lesson("大学併修1年", "プログラミング", "岸本"),
    "202": lesson("医療情報1年", "情報基礎", "三和田"),
    "203": lesson("ゲームITエキスパート1年", "ゲーム制作", "石原"),
    "301": lesson("システム専攻1年", "ネットワーク", "上田"),
    "302": { kind: "free" },
    "303": lesson("医療情報2年", "医療事務", "中村"),
    "304": lesson("ゲームITエキスパート2年", "ゲーム設計", "太田"),
    "305": { kind: "free" },
    "401": lesson("大学併修3年", "卒業研究", "古村"),
    "402": { kind: "free" },
    "403": lesson("大学併修4年", "卒業研究", "岸本"),
    "501": lesson("医療情報4年", "実習", "石原"),
    "502": { kind: "free" },
    "503": { kind: "reserved" },
    "504": { kind: "free" },
    "505": { kind: "blocked" },
    "601": { kind: "free" },
    "602": lesson("医療情報3年", "データ分析", "三和田"),
    "603": { kind: "free" },
    "604": { kind: "reserved" },
  };
}
