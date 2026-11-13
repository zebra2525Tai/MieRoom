// S30 モニターのフロアマップ (6階分)。図の形と位置だけを持つ。I/O はない。
// 座標は 480×300 の図の単位。画面には SCALE 倍で描く。教室名 (rooms.name) と、図の教室名を
// 結びつけて、色と文字を出す。図にない教室は出ず、マスタにない教室は「使えない」色になる。

export type Pt = readonly [number, number];

export type PlanKind =
  | "room" // 授業・予約の対象の教室 (状態の色が付く)
  | "fac" // 倉庫・階段・EV・WC など
  | "office" // 事務室・職員室など
  | "green" // テラス・玄関・学生ホール
  | "emerg" // 非常階段
  | "open" // 開けた空間 (点線)
  | "wc"; // 男子・女子・多目的のトイレ

export type PlanRoom = {
  name: string;
  points: readonly Pt[];
  kind: PlanKind;
  /** 小さい施設 (文字を小さくする) */
  small?: boolean;
  /** 上の部屋の下にくっついている (上の辺の線を引かない) */
  attachTop?: boolean;
  /** 文字を縦に書く */
  vertical?: boolean;
  /** 文字の中心 (広い部分に置きたいとき) */
  labelAt?: Pt;
  /** wc のとき: m 男子 / f 女子 / a 多目的 */
  gender?: "m" | "f" | "a";
};

export type Floor = {
  id: "6F" | "5F" | "4F" | "3F" | "2F" | "1F";
  title: string;
  color: string;
  /** 建物の外枠 */
  outline: readonly Pt[];
  rooms: readonly PlanRoom[];
};

/** 480×300 の図を 600×375 にする。 */
export const SCALE = 1.25;

const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

// 左の壁は (0,0)→(70,290) の斜め。左が斜めの教室は、この線に合わせる。
const slantTop = (w: number): Pt[] => [
  [0, 0],
  [w, 0],
  [w, 100],
  [24.1, 100],
];
const lower: Pt[] = [
  [30.2, 125],
  [173, 125],
  [173, 290],
  [70, 290],
];
const OUTLINE: Pt[] = [
  [0, 0],
  [472, 0],
  [472, 148],
  [343, 148],
  [343, 290],
  [70, 290],
];
const OUTLINE_1F: Pt[] = [
  [0, 0],
  [472, 0],
  [472, 172],
  [430, 172],
  [430, 290],
  [48, 290],
];

const common: PlanRoom[] = [
  // EV と階段は、セットで並べる (それぞれの線は残す)
  { name: "EV", points: rect(206, 262, 24, 28), kind: "fac", small: true },
  { name: "階段", points: rect(230, 238, 38, 52), kind: "fac", small: true },
];
const emerg: PlanRoom = {
  name: "非常階段",
  points: rect(442, 100, 30, 48),
  kind: "emerg",
  vertical: true,
};
const wc = (gender: "m" | "f" | "a", x: number, w: number): PlanRoom => ({
  name: "",
  points: rect(x, 238, w, 52),
  kind: "wc",
  gender,
});

export const FLOORS: readonly Floor[] = [
  {
    id: "6F",
    title: "教室・コンピュータルーム",
    color: "#6a3fb5",
    outline: OUTLINE,
    rooms: [
      { name: "603", points: slantTop(165.4), kind: "room" },
      { name: "602", points: rect(165.4, 0, 153.3, 100), kind: "room" },
      { name: "601", points: rect(318.7, 0, 153.3, 100), kind: "room" },
      emerg,
      { name: "604", points: lower, kind: "room" },
      { name: "倉庫", points: rect(173, 125, 85, 70), kind: "fac" },
      ...common,
      wc("m", 268, 72),
    ],
  },
  {
    id: "5F",
    title: "教室・コンピュータルーム",
    color: "#b0356d",
    outline: OUTLINE,
    rooms: [
      { name: "503", points: slantTop(165.4), kind: "room" },
      { name: "502", points: rect(165.4, 0, 153.3, 100), kind: "room" },
      { name: "501", points: rect(318.7, 0, 153.3, 100), kind: "room" },
      {
        name: "倉庫",
        points: rect(396, 101, 46, 15),
        kind: "fac",
        small: true,
        attachTop: true,
      },
      emerg,
      { name: "505", points: rect(173, 125, 85, 70), kind: "room" },
      { name: "504", points: lower, kind: "room" },
      ...common,
      wc("f", 268, 72),
    ],
  },
  {
    id: "4F",
    title: "コンピュータルーム・学生ホール",
    color: "#a9590f",
    outline: OUTLINE,
    rooms: [
      { name: "403", points: slantTop(165.4), kind: "room" },
      { name: "402", points: rect(165.4, 0, 153.3, 100), kind: "room" },
      { name: "401", points: rect(318.7, 0, 153.3, 100), kind: "room" },
      emerg,
      { name: "学生ホール", points: lower, kind: "green" },
      ...common,
      wc("m", 268, 36),
      wc("f", 304, 36),
    ],
  },
  {
    id: "3F",
    title: "教室・コンピュータルーム",
    color: "#1f62c4",
    outline: OUTLINE,
    rooms: [
      {
        name: "303",
        points: [
          [0, 0],
          [165.4, 0],
          [165.4, 100],
          [24.1, 100],
        ],
        kind: "room",
      },
      { name: "302", points: rect(165.4, 0, 153.3, 100), kind: "room" },
      { name: "301", points: rect(318.7, 0, 153.3, 100), kind: "room" },
      emerg,
      { name: "305", points: rect(173, 125, 85, 70), kind: "room" },
      { name: "304", points: lower, kind: "room" },
      ...common,
      wc("m", 268, 72),
    ],
  },
  {
    id: "2F",
    title: "事務室・保健室・理事長室",
    color: "#16795f",
    outline: OUTLINE,
    rooms: [
      {
        name: "202",
        points: [
          [0, 0],
          [173, 0],
          [173, 92],
          [22.2, 92],
        ],
        kind: "room",
      },
      { name: "201", points: rect(204, 0, 141, 116), kind: "room" },
      {
        name: "事務室",
        points: rect(345, 0, 127, 100),
        kind: "office",
      },
      {
        name: "保健室",
        points: rect(345, 100, 53, 16),
        kind: "office",
        small: true,
        attachTop: true,
      },
      emerg,
      {
        name: "203",
        points: [
          [22.2, 92],
          [173, 92],
          [173, 184],
          [44.5, 184],
        ],
        kind: "room",
      },
      {
        name: "理事長室",
        points: [
          [44.5, 184],
          [173, 184],
          [173, 290],
          [70, 290],
        ],
        kind: "office",
      },
      ...common,
      wc("f", 268, 36),
      wc("a", 304, 36),
    ],
  },
  {
    id: "1F",
    title: "玄関・受付・職員室",
    color: "#3a7a2a",
    outline: OUTLINE_1F,
    rooms: [
      {
        name: "テラス",
        // 101 と同じ高さで、壁 (左の斜めの線) から 101 までいっぱいに
        points: [
          [0, 0],
          [50, 0],
          [50, 152],
          [25.2, 152],
        ],
        kind: "green",
        small: true,
        vertical: true,
      },
      { name: "101", points: rect(50, 0, 115, 152), kind: "room" },
      { name: "学生ホール", points: rect(185, 20, 115, 60), kind: "open" },
      emerg,
      {
        name: "職員室",
        points: [
          [306, 148],
          [472, 148],
          [472, 172],
          [430, 172],
          [430, 290],
          [306, 290],
        ],
        kind: "office",
        labelAt: [368, 212],
      },
      // 職員室の中 (左の端)。職員室より後に書いて、上に重ねる
      {
        name: "受付",
        points: rect(306, 148, 20, 74),
        kind: "office",
        small: true,
        vertical: true,
      },
      {
        name: "玄関",
        points: [
          [31.4, 190],
          [112, 190],
          [112, 290],
          [48, 290],
        ],
        kind: "green",
      },
      { name: "", points: rect(328, 0, 55, 100), kind: "fac" },
      { name: "", points: rect(383, 0, 55, 100), kind: "fac" },
      { name: "EV", points: rect(208, 262, 24, 28), kind: "fac", small: true },
      {
        name: "階段",
        points: rect(268, 238, 38, 52),
        kind: "fac",
        small: true,
      },
      { name: "WC", points: rect(232, 238, 36, 52), kind: "fac" },
    ],
  },
];

/** 状態の色が付く教室の名前 (図の中の kind が room のもの)。 */
export const PLAN_ROOM_NAMES: readonly string[] = FLOORS.flatMap((floor) =>
  floor.rooms.filter((room) => room.kind === "room").map((room) => room.name),
);

/** 図の教室1つの、いまの状態 (または、次の時限の状態)。 */
export type RoomState =
  | { kind: "free" }
  | { kind: "reserved" }
  | { kind: "blocked" }
  | {
      kind: "lesson";
      /** true: 休み時間に出す「次の授業」 */
      next: boolean;
      className: string;
      subject: string;
      teacher: string;
    };

/** 教室名 → 状態。図にあってここにない教室は、マスタにない (または無効) ものとして、灰色にする。 */
export type RoomStates = Readonly<Record<string, RoomState>>;
