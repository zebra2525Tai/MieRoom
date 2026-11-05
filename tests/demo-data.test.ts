import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readCsv, writeCsv } from "@/scripts/demo-data/csv";
import { buildFiles, CLASSES, MONTHS } from "@/scripts/demo-data/model";
import { validateFiles } from "@/scripts/demo-data/validate";

const root = join(process.cwd(), "demo-data");

function readDisk(dir = root, prefix = ""): Map<string, string> {
  const files = new Map<string, string>();
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const path = prefix === "" ? name : `${prefix}/${name}`;
    if (statSync(full).isDirectory()) {
      for (const [p, c] of readDisk(full, path)) files.set(p, c);
    } else {
      files.set(path, readFileSync(full, "utf8"));
    }
  }
  return files;
}

/** Copy of the generated files with one file changed by `edit` (on the cells, header excluded). */
function broken(
  path: string,
  edit: (rows: string[][]) => string[][],
): Map<string, string> {
  const files = new Map(buildFiles());
  const [header, ...rows] = readCsv(files.get(path) ?? "");
  files.set(path, writeCsv(header, edit(rows)));
  return files;
}

const TIMETABLE = `timetable/202611/大学併修1年_202611_取込用.csv`;

describe("demo data", () => {
  it("passes every rule of 外部設計書 08章 / 07章", () => {
    expect(validateFiles(buildFiles())).toEqual([]);
  });

  it("has 12 classes and a file for each class and month", () => {
    const files = buildFiles();
    expect(CLASSES).toHaveLength(12);
    expect(
      [...files.keys()].filter((p) => p.startsWith("timetable/")),
    ).toHaveLength(12 * MONTHS.length);
  });

  it("is the same as the committed files (run npm run demo-data after changing the generator)", () => {
    const expected = buildFiles();
    const actual = readDisk();
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [path, content] of expected) {
      expect(actual.get(path), path).toBe(content);
    }
  });

  it("is deterministic", () => {
    expect(buildFiles()).toEqual(buildFiles());
  });

  it("leaves April out of the March files (R3-4)", () => {
    const march = [...buildFiles()].filter(([p]) =>
      p.startsWith("timetable/202703/"),
    );
    expect(march).toHaveLength(12);
    for (const [, content] of march) {
      expect(content).not.toMatch(/,2027-04-/);
    }
  });

  it("has no real e-mail address or secret-looking value", () => {
    for (const [path, content] of buildFiles()) {
      expect(content, path).not.toMatch(
        /@|https?:\/\/|[0-9a-f]{8}-[0-9a-f]{4}-/i,
      );
    }
  });
});

// The validator must also say no. Each case breaks one rule on purpose.
describe("demo data validator", () => {
  it("rejects a lesson that is not on a period", () => {
    const files = broken(TIMETABLE, (rows) => {
      rows[0][4] = "9:30";
      return rows;
    });
    expect(validateFiles(files).join("\n")).toContain("ME419");
  });

  it("rejects 外部講師", () => {
    const files = broken(TIMETABLE, (rows) => {
      const row = rows.find((r) => r[9] === "固定");
      if (row) row[7] = "外部講師";
      return rows;
    });
    expect(validateFiles(files).join("\n")).toContain("ME413");
  });

  it("rejects a weekday without lesson or event name (ME412)", () => {
    const files = broken(TIMETABLE, (rows) =>
      rows.filter((r) => r[1] !== "2026-11-03"),
    );
    expect(validateFiles(files).join("\n")).toContain("ME412");
  });

  it("rejects two lessons at the same start (ME415)", () => {
    const files = broken(TIMETABLE, (rows) => {
      const first = rows.findIndex((r) => r[9] === "固定");
      rows.splice(first + 1, 0, [...rows[first]]);
      return rows;
    });
    expect(validateFiles(files).join("\n")).toContain("ME415");
  });

  it("rejects an unknown subject (ME409)", () => {
    const files = broken(TIMETABLE, (rows) => {
      const row = rows.find((r) => r[9] === "固定");
      if (row) row[6] = "存在しない教科";
      return rows;
    });
    expect(validateFiles(files).join("\n")).toContain("ME409");
  });

  it("rejects a wrong 当月の最終入力日 (ME411)", () => {
    const files = broken(TIMETABLE, (rows) => {
      rows[0][10] = "2026-11-29";
      return rows;
    });
    expect(validateFiles(files).join("\n")).toContain("ME411");
  });

  // A slot where both 大学併修1年 and 医療情報1年 have a 固定 lesson in November.
  function commonSlot() {
    const files = new Map(buildFiles());
    const otherPath = "timetable/202611/医療情報1年_202611_取込用.csv";
    const [header, ...rows] = readCsv(files.get(TIMETABLE) ?? "");
    const [otherHeader, ...otherRows] = readCsv(files.get(otherPath) ?? "");
    for (const row of rows) {
      if (row[9] !== "固定" || row[7] === "" || row[1] > "2026-11-30") continue;
      const other = otherRows.find(
        (r) => r[1] === row[1] && r[4] === row[4] && r[9] === "固定",
      );
      if (other)
        return { files, otherPath, otherHeader, otherRows, row, other, header };
    }
    throw new Error("no common slot found");
  }

  it("rejects a teacher who is in two classes at the same time", () => {
    const { files, otherPath, otherHeader, otherRows, row, other } =
      commonSlot();
    other[7] = row[7];
    files.set(otherPath, writeCsv(otherHeader, otherRows));
    expect(validateFiles(files).join("\n")).toContain(" teaches ");
  });

  it("rejects a room used by two classes", () => {
    const { files, otherPath, otherHeader, otherRows, row, other } =
      commonSlot();
    other[8] = row[8];
    files.set(otherPath, writeCsv(otherHeader, otherRows));
    expect(validateFiles(files).join("\n")).toContain("is used by");
  });

  it("rejects a 翌月 part that differs from the next month's file", () => {
    const files = new Map(buildFiles());
    const path = "timetable/202612/大学併修1年_202612_取込用.csv";
    const [header, ...rows] = readCsv(files.get(path) ?? "");
    const index = rows.findIndex(
      (r) => r[1] === "2026-12-02" && r[9] === "固定",
    );
    expect(index).toBeGreaterThan(-1);
    rows[index][6] = "英語A";
    rows[index][7] = "石原";
    files.set(path, writeCsv(header, rows));
    const problems = validateFiles(files).join("\n");
    expect(problems.length).toBeGreaterThan(0);
  });

  it("rejects a missing month", () => {
    const files = new Map(buildFiles());
    files.delete("timetable/202701/医療情報2年_202701_取込用.csv");
    expect(validateFiles(files).join("\n")).toContain("file is missing");
  });

  it("rejects 各担当 in the teacher master (ME503)", () => {
    const files = broken("master/講師マスタ.csv", (rows) => [
      ...rows,
      ["各担当"],
    ]);
    expect(validateFiles(files).join("\n")).toContain("ME503");
  });

  it("rejects a class whose home room is not a ホームルーム room (R5-6)", () => {
    const files = broken("master/クラスマスタ.csv", (rows) => {
      rows[0][1] = "E101";
      return rows;
    });
    expect(validateFiles(files).join("\n")).toContain("R5-6");
  });

  it("rejects a subject with no teacher row (R5-6 #3)", () => {
    const files = broken("master/紐づけ_教科の講師.csv", (rows) =>
      rows.slice(1),
    );
    expect(validateFiles(files).join("\n")).toContain("R5-6 #3");
  });

  it("rejects a wrong number of subjects for a grade", () => {
    const files = broken("master/紐づけ_クラスの教科.csv", (rows) =>
      rows.slice(1),
    );
    expect(validateFiles(files).join("\n")).toContain("expected");
  });

  it("rejects files that lose their BOM or CRLF", () => {
    const files = new Map(buildFiles());
    const path = "master/教科マスタ.csv";
    files.set(path, (files.get(path) ?? "").replaceAll("\r\n", "\n"));
    expect(validateFiles(files).join("\n")).toContain("CRLF");
    files.set(path, (files.get(path) ?? "").replace("﻿", ""));
    expect(validateFiles(files).join("\n")).toContain("BOM");
  });

  it("rejects a missing event row from CSV-08 in a timetable", () => {
    const files = broken(TIMETABLE, (rows) =>
      rows.filter((r) => !(r[6] === "学園祭" && r[1] === "2026-11-12")),
    );
    expect(validateFiles(files).join("\n")).toContain("学園祭");
  });
});
