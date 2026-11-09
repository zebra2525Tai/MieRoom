// A second reading of the Excel tool's checks on the master CSVs, written from
// 時間割作成ツール の TimetableTools.bas (2026-10-27 12:59): ImportMasters / LoadMasterFile /
// CheckEventData (each file) and CheckMasters / CheckLinks (all tables together, which the
// tool runs right after importing). It shares no code with the system's own reader
// (lib/domain/master-csv.ts), so that "the files the system writes are accepted by the tool"
// is checked against the tool's rules and not against the writer's own idea of them.
// It is a port, not the macro itself: the last proof is ImportMasters in Excel.

const NO_TEACHER = "各担当";
const BAN_TEACHER = "外部講師";
const NO_ROOM = "ー";
const LIMITS = { master: 100, link: 1000, event: 200 };

/** ParseCsv in the tool: commas, quotes, LF ends a row, a bare CR is dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let fields: string[] = [];
  let cur = "";
  let inQuote = false;
  let has = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuote = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuote = true;
      has = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
      has = true;
    } else if (ch === "\n") {
      fields.push(cur);
      rows.push(fields);
      fields = [];
      cur = "";
      has = false;
    } else if (ch !== "\r") {
      cur += ch;
      has = true;
    }
  }
  if (has || cur !== "" || fields.length > 0) {
    fields.push(cur);
    rows.push(fields);
  }
  return rows;
}

const normText = (s: string) =>
  s.replaceAll("　", " ").replaceAll(" ", " ").trim();
const normRoom = (s: string) =>
  normText(s).replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10));

function validDate(text: string): string | null {
  const t = normRoom(text).replaceAll("/", "-").split(" ")[0];
  const p = t.split("-");
  if (
    p.length !== 3 ||
    p.some((x) => !/^[0-9]{1,4}$/.test(x)) ||
    p[0].length !== 4
  ) {
    return null;
  }
  const [y, m, d] = p.map(Number);
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${p[0]}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// kind: 0 クラス 1 講師 2 教科 3 教室 / 4 クラスの教科 5 教科の講師 6 教科の教室 / 7 休み・行事
const HEADS: string[][] = [
  ["クラス名", "ホームルーム教室"],
  ["時間割での表記"],
  ["教科名"],
  ["教室名", "棟・階", "分類", "備考"],
  ["クラス", "教科"],
  ["クラス", "教科", "講師"],
  ["クラス", "教科", "教室"],
  ["開始日", "終了日", "名称", "対象クラス"],
];

type Table = { kind: number; rows: string[][] };

/** One file, as LoadMasterFile reads it. Problems are added to `problems`. */
function loadFile(
  name: string,
  text: string,
  problems: string[],
): Table | null {
  const start = problems.length;
  const bad = (line: number, reason: string) =>
    problems.push(`${name}${line > 0 ? ` ${line}行目` : ""}: ${reason}`);
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const grid = parseCsv(body);
  if (grid.length === 0) {
    bad(0, "中身がありません");
    return null;
  }
  const hdr = grid[0].map(normText);
  const has = (h: string) => hdr.includes(h);
  let kind = -1;
  if (has("クラス名")) kind = 0;
  else if (has("時間割での表記")) kind = 1;
  else if (has("教科名")) kind = 2;
  else if (has("教室名")) kind = 3;
  else if (has("開始日") && has("名称")) kind = 7;
  else if (has("クラス") && has("教科")) {
    kind = has("講師") ? 5 : has("教室") ? 6 : 4;
  }
  if (kind < 0) {
    bad(0, "マスタ・紐づけのCSVではありません");
    return null;
  }
  if (kind === 4) {
    for (const h of grid[0]) {
      if (h.includes("講師") || h.includes("教室")) {
        bad(1, `見出し「${normText(h)}」は、クラスの教科の表にありません`);
      }
    }
    if (problems.length > start) return null;
  }
  const want = HEADS[kind];
  const optional = (j: number) =>
    (kind === 3 || kind === 7) && (j === 1 || j === 3);
  const pos = want.map((h) => hdr.indexOf(h));
  let missing = false;
  want.forEach((h, j) => {
    if (pos[j] < 0 && !optional(j)) {
      bad(1, `見出し「${h}」がありません`);
      missing = true;
    }
  });
  if (missing) return null;

  const maxRows =
    kind === 7 ? LIMITS.event : kind >= 4 ? LIMITS.link : LIMITS.master;
  const rows: string[][] = [];
  const seen = new Set<string>();
  let count = 0;
  let tooMany = false;
  grid.slice(1).forEach((raw, index) => {
    const line = index + 2;
    if (raw.every((cell) => normText(cell) === "")) return;
    count++;
    if (count > maxRows) {
      if (!tooMany) bad(0, `行数が多すぎます(上限 ${maxRows} 行)`);
      tooMany = true;
      return;
    }
    const row = want.map((_, j) => {
      const v = pos[j] >= 0 && pos[j] < raw.length ? normText(raw[pos[j]]) : "";
      const isRoomColumn =
        (kind === 3 && j === 0) ||
        (kind === 0 && j === 1) ||
        (kind === 6 && j === 2);
      return isRoomColumn ? normRoom(v) : v;
    });
    if (kind === 7) {
      const d1 = validDate(row[0]);
      const d2 = row[1] === "" ? d1 : validDate(row[1]);
      if (row[0] === "") bad(line, "開始日が空欄です");
      else if (d1 === null)
        bad(line, `開始日「${row[0]}」が日付として読めません`);
      if (row[1] !== "" && d2 === null)
        bad(line, `終了日「${row[1]}」が日付として読めません`);
      if (d1 !== null && d2 !== null && d2 < d1)
        bad(line, "終了日が開始日より前です");
      if (row[2] === "") bad(line, "名称が空欄です");
      if (d1 !== null) row[0] = d1;
      row[1] = d2 ?? "";
    } else if (kind < 4) {
      if (row[0] === "") bad(line, `${want[0]}が空欄です`);
    } else {
      want.forEach((h, j) => {
        if (row[j] === "") bad(line, `「${h}」が空欄です`);
      });
    }
    if (!tooMany) {
      const key = kind < 4 ? row[0] : row.join("|");
      if (key !== "") {
        if (seen.has(key)) bad(line, `同じ行が重複しています(${key})`);
        else seen.add(key);
      }
    }
    if (kind === 0 && row[1] === "") bad(line, "ホームルーム教室が空欄です");
    if (kind === 1 && row[0] === NO_TEACHER)
      bad(line, `「${row[0]}」はマスタに入れません`);
    if (kind === 1 && row[0] === BAN_TEACHER)
      bad(line, `「${row[0]}」は講師として使えません`);
    if (kind === 3 && row[2] !== "ホームルーム" && row[2] !== "空き教室") {
      bad(line, "分類は「ホームルーム」か「空き教室」です");
    }
    rows.push(row);
  });
  if (count === 0) bad(0, "データの行がありません");
  return problems.length > start ? null : { kind, rows };
}

/**
 * What ImportMasters (8 files chosen together) and the CheckMasters / CheckLinks that runs
 * right after it find. An empty list means the tool takes the files and shows no red cell.
 */
export function excelToolProblems(
  files: { name: string; text: string }[],
): string[] {
  const problems: string[] = [];
  const tables = new Map<number, Table>();
  for (const file of files) {
    const table = loadFile(file.name, file.text, problems);
    if (table === null) continue;
    if (tables.has(table.kind)) {
      problems.push(`${file.name}: 同じ種類のCSVが2つあります`);
    } else tables.set(table.kind, table);
  }
  if (problems.length > 0) return problems;
  // Not an error in the tool (a table may be left as it was), but this system always sends
  // all 8, so a missing one means a broken export.
  for (let kind = 0; kind < 8; kind++) {
    if (!tables.has(kind))
      problems.push(`種類 ${kind} のCSVがありません(8つそろえて書き出す)`);
  }
  if (problems.length > 0) return problems;

  const col = (kind: number, j: number) =>
    tables.get(kind)!.rows.map((r) => r[j]);
  const classes = new Set(col(0, 0));
  const teachers = new Set(col(1, 0));
  const subjects = new Set(col(2, 0));
  const rooms = new Set(col(3, 0));

  // CheckEventData
  for (const cls of col(7, 3)) {
    if (cls !== "" && !classes.has(cls)) {
      problems.push(
        `休み・行事のCSV: 対象クラス「${cls}」がクラスマスタにありません`,
      );
    }
  }
  // CheckMasters: a class's home room is in the room master; two classes never share one.
  const homeRooms = new Map<string, string>();
  for (const [name, room] of tables.get(0)!.rows) {
    if (!rooms.has(room))
      problems.push(
        `クラス「${name}」: 教室「${room}」が教室マスタにありません`,
      );
    const other = homeRooms.get(room);
    if (other !== undefined) {
      problems.push(
        `ホームルーム教室「${room}」が重複しています(${other}、${name})`,
      );
    }
    homeRooms.set(room, name);
  }
  // CheckLinks
  const pairs = (kind: number) =>
    new Set(tables.get(kind)!.rows.map((r) => `${r[0]}|${r[1]}`));
  const ownSubjects = pairs(4);
  for (const kind of [4, 5, 6]) {
    for (const row of tables.get(kind)!.rows) {
      if (!classes.has(row[0]))
        problems.push(`クラス「${row[0]}」がクラスマスタにありません`);
      if (!subjects.has(row[1]))
        problems.push(`教科「${row[1]}」が教科マスタにありません`);
      if (kind === 5 && row[2] !== NO_TEACHER && !teachers.has(row[2])) {
        problems.push(`講師「${row[2]}」が講師マスタにありません`);
      }
      if (kind === 6 && row[2] !== NO_ROOM && !rooms.has(row[2])) {
        problems.push(`教室「${row[2]}」が教室マスタにありません`);
      }
      if (kind > 4 && !ownSubjects.has(`${row[0]}|${row[1]}`)) {
        problems.push(
          `クラス「${row[0]}」の教科「${row[1]}」が、クラスの教科の表にありません`,
        );
      }
    }
  }
  const withTeacher = pairs(5);
  for (const key of ownSubjects) {
    if (!withTeacher.has(key)) {
      const [cls, subject] = key.split("|");
      problems.push(
        `クラス「${cls}」の教科「${subject}」の講師が、教科の講師の表にありません`,
      );
    }
  }
  return problems;
}
