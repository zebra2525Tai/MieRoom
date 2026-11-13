import type { Pt } from "./floor-plan";

// フロアマップの教室の中の文字を、どこに、どの大きさで置くか。I/O はない。
// 同じ項目は、どの教室でも同じ大きさにする (縮めない。入らないときは行を分ける)。
// 座標は、図を SCALE 倍した画面の単位 (パネルの左上が原点)。

export const FONT = {
  num: 24, // 教室番号
  cls: 17, // クラス名
  sub: 15, // 教科
  tch: 15, // 先生
  state: 19, // 空き・予約使用中・使用止め
  name: 18, // 部屋の名前 (倉庫・職員室など)
  small: 13, // 小さい施設 (階段・EV など)
} as const;

/** 文字の幅の見積もり: 全角は 1em、半角は 0.58em。 */
export function estimateWidth(text: string, size: number): number {
  return [...text].reduce(
    (sum, ch) => sum + (ch.charCodeAt(0) < 256 ? 0.58 : 1) * size,
    0,
  );
}

/** 長い文字を、同じ長さに近い行に分ける (入る幅 avail に収まる行数)。 */
export function balanceLines(
  text: string,
  size: number,
  avail: number,
): string[] {
  const rows = Math.max(1, Math.ceil(estimateWidth(text, size) / avail));
  const chars = [...text];
  const per = Math.ceil(chars.length / rows);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += per) {
    out.push(chars.slice(i, i + per).join(""));
  }
  return out;
}

/** 図形の重心 (面積の中心)。頂点の平均より、斜めの教室で中央に寄る。 */
export function centroid(points: readonly Pt[]): Pt {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const f = x1 * y2 - x2 * y1;
    area += f;
    x += (x1 + x2) * f;
    y += (y1 + y2) * f;
  }
  return [x / (3 * area), y / (3 * area)];
}

/** 高さ y での、図形の左右の端。 */
export function extentAt(points: readonly Pt[], y: number): [number, number] {
  const xs: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
      xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  return xs.length === 0 ? [0, 0] : [Math.min(...xs), Math.max(...xs)];
}

export function boundsOf(points: readonly Pt[]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

export type TextLine = {
  text: string;
  size: number;
  bold: boolean;
  /** main: 教室番号・クラス名 / sub: 教科・先生 */
  tone: "main" | "sub";
  y: number;
};

export type LessonText = {
  className: string;
  subject: string;
  teacher: string;
};

/**
 * 授業中・次の授業の教室の文字。教室番号 / クラス名 / 教科と先生。
 * 斜めの壁にかからないよう、いちばん下の行の高さで、使える幅と中心を決める。
 * points は画面の単位 (SCALE 倍)、anchor はその中の文字の中心。
 */
export function lessonLayout(
  points: readonly Pt[],
  anchor: Pt,
  roomName: string,
  lesson: LessonText,
): { x: number; lines: TextLine[] } {
  const bounds = boundsOf(points);
  const width = bounds.x1 - bounds.x0;

  const build = (rawAvail: number) => {
    const avail = Math.max(rawAvail, 48);
    const rows: Omit<TextLine, "y">[] = [
      { text: roomName, size: FONT.num, bold: true, tone: "main" },
    ];
    for (const text of balanceLines(lesson.className, FONT.cls, avail)) {
      rows.push({ text, size: FONT.cls, bold: true, tone: "main" });
    }
    const both = `${lesson.subject}/${lesson.teacher}`;
    if (estimateWidth(both, FONT.sub) <= avail) {
      rows.push({ text: both, size: FONT.sub, bold: false, tone: "sub" });
    } else {
      for (const text of balanceLines(lesson.subject, FONT.sub, avail)) {
        rows.push({ text, size: FONT.sub, bold: false, tone: "sub" });
      }
      for (const text of balanceLines(lesson.teacher, FONT.tch, avail)) {
        rows.push({ text, size: FONT.tch, bold: true, tone: "sub" });
      }
    }
    return rows;
  };
  const place = (rows: Omit<TextLine, "y">[]) => {
    const heights = rows.map((row) => row.size * 1.3);
    const total = heights.reduce((a, b) => a + b, 0);
    let y = anchor[1] - total / 2;
    return rows.map((row, i) => {
      const at = y + heights[i] / 2;
      y += heights[i];
      return at;
    });
  };

  let avail = width - 24;
  let rows = build(avail);
  for (let i = 0; i < 3; i++) {
    const ys = place(rows);
    const [x0, x1] = extentAt(points, ys[ys.length - 1]);
    avail = Math.min(width - 24, x1 - x0 - 16);
    rows = build(avail);
  }
  // 小さい教室で、行が教室の高さに入らないときは、下の行 (先生・教科) から減らす。
  // 教室番号とクラス名は、最後まで残す。
  const fits = (list: Omit<TextLine, "y">[]) => {
    const ys = place(list);
    const first = list[0].size / 2;
    const last = list[list.length - 1].size / 2;
    return (
      ys[0] - first >= bounds.y0 + 3 &&
      ys[ys.length - 1] + last <= bounds.y1 - 3
    );
  };
  while (rows.length > 2 && !fits(rows)) rows = rows.slice(0, -1);
  const ys = place(rows);
  const [x0, x1] = extentAt(points, ys[ys.length - 1]);
  return {
    x: (x0 + x1) / 2,
    lines: rows.map((row, i) => ({ ...row, y: ys[i] })),
  };
}
