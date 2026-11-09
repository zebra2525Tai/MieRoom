import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  buildMasterData,
  MASTER_FILES,
  MASTER_HEADERS,
  type MasterData,
  type MasterFileKey,
  type MasterFileTexts,
} from "@/lib/domain/master-csv";
import {
  buildExport,
  masterExportRange,
  type ExportSource,
} from "@/lib/domain/master-export";
import {
  buildMasterZip,
  masterZipAsciiName,
  masterZipName,
} from "@/lib/domain/master-zip";
import { excelToolProblems, parseCsv } from "./support/excel-tool";
import { demoSource, demoTexts } from "./support/master-source";

const KEYS = Object.keys(MASTER_FILES) as MasterFileKey[];

function changed(edit: (source: ExportSource) => void): ExportSource {
  const source = structuredClone(demoSource());
  edit(source);
  return source;
}

const textsOf = (files: { key: MasterFileKey; content: string }[]) =>
  Object.fromEntries(files.map((f) => [f.key, f.content])) as MasterFileTexts;

const errorsOf = (source: ExportSource) =>
  buildExport(source).issues.filter((i) => i.level === "error");

const sorted = <T>(rows: T[]) => rows.map((r) => JSON.stringify(r)).sort();

describe("buildExport: 実際の形のマスタ(デモデータ)", () => {
  const result = buildExport(demoSource());

  it("確認に引っかからず、8つのファイルを作る", () => {
    expect(result.issues).toEqual([]);
    expect(result.files?.map((f) => f.name)).toEqual(
      KEYS.map((key) => MASTER_FILES[key]),
    );
  });

  it("書き出したものを読み直すと、元のデータと同じ(並びは問わない)", () => {
    const { data: original } = buildMasterData(demoTexts());
    const { data, issues } = buildMasterData(textsOf(result.files!));
    expect(issues).toEqual([]);
    for (const key of Object.keys(original!) as (keyof MasterData)[]) {
      expect(sorted(data![key] as unknown[]), key).toEqual(
        sorted(original![key] as unknown[]),
      );
    }
  });

  it("ツールの取り込み(ImportMasters と、そのあとの入力チェック)に通る", () => {
    expect(
      excelToolProblems(
        result.files!.map((f) => ({ name: f.name, text: f.content })),
      ),
    ).toEqual([]);
  });

  it("書式: BOM付き UTF-8、CRLF、見出しは仕様の順", () => {
    for (const file of result.files!) {
      expect(file.content.charCodeAt(0), file.name).toBe(0xfeff);
      expect(file.content.endsWith("\r\n"), file.name).toBe(true);
      expect(
        file.content.replaceAll("\r\n", "").includes("\n"),
        file.name,
      ).toBe(false);
      expect(parseCsv(file.content.slice(1))[0], file.name).toEqual(
        MASTER_HEADERS[file.key],
      );
      expect(parseCsv(file.content.slice(1)).length - 1, file.name).toBe(
        file.rows,
      );
    }
  });

  it("並びは名前の順(教室は数字の大きさ順)、紐づけはクラス・教科の順", () => {
    const rooms = parseCsv(
      result.files!.find((f) => f.key === "rooms")!.content.slice(1),
    )
      .slice(1)
      .map((r) => r[0]);
    expect(rooms).toEqual(
      [...rooms].sort((a, b) => a.localeCompare(b, "ja", { numeric: true })),
    );
    const links = parseCsv(
      result.files!.find((f) => f.key === "subjectTeachers")!.content.slice(1),
    ).slice(1);
    const classes = links.map((r) => r[0]);
    expect(classes).toEqual(
      [...classes].sort((a, b) => a.localeCompare(b, "ja", { numeric: true })),
    );
  });
});

describe("buildExport: 値の書き方", () => {
  it("講師なしは「各担当」、教室未定は「ー」、1日だけの休みは終了日を空にする", () => {
    const source = changed((s) => {
      s.classes[0].teachers[0].teacherName = null;
      s.classes[0].rooms[0].roomName = null;
      s.closures = [
        {
          startDate: "2026-11-03",
          endDate: null,
          name: "文化の日",
          className: null,
        },
        {
          startDate: "2026-11-23",
          endDate: "2026-11-23",
          name: "勤労感謝の日",
          className: null,
        },
        {
          startDate: "2026-12-28",
          endDate: "2027-01-04",
          name: "冬休み",
          className: s.classes[0].name,
        },
      ];
    });
    const files = buildExport(source).files!;
    const text = (key: MasterFileKey) =>
      files.find((f) => f.key === key)!.content;
    expect(text("subjectTeachers")).toContain(",各担当\r\n");
    expect(text("subjectRooms")).toContain(",ー\r\n");
    const closures = parseCsv(text("closures").slice(1)).slice(1);
    expect(closures).toEqual([
      ["2026-11-03", "", "文化の日", ""],
      ["2026-11-23", "", "勤労感謝の日", ""],
      ["2026-12-28", "2027-01-04", "冬休み", source.classes[0].name],
    ]);
  });

  it('「,」や「"」を含む欄は、囲んで書く。読み直しても同じ', () => {
    const source = changed((s) => {
      s.rooms[0].note = 'A,B "C"';
    });
    const result = buildExport(source);
    const content = result.files!.find((f) => f.key === "rooms")!.content;
    expect(content).toContain('"A,B ""C"""');
    const { data } = buildMasterData(textsOf(result.files!));
    expect(data!.rooms.find((r) => r.name === source.rooms[0].name)!.note).toBe(
      'A,B "C"',
    );
    expect(
      excelToolProblems(
        result.files!.map((f) => ({ name: f.name, text: f.content })),
      ),
    ).toEqual([]);
  });

  it("有効でないマスタは出さない。無効な講師は、紐づけに残っていなければ出ない", () => {
    const source = changed((s) => {
      s.teachers.push({ displayName: "退職者", active: false });
      s.subjects.push({ name: "廃止教科", active: false });
      s.rooms.push({
        name: "999",
        building: null,
        kind: "FREE",
        note: null,
        active: false,
      });
    });
    const result = buildExport(source);
    expect(result.issues).toEqual([]);
    const all = result.files!.map((f) => f.content).join("");
    expect(all).not.toContain("退職者");
    expect(all).not.toContain("廃止教科");
    expect(all).not.toContain("999");
  });

  it("書き出す範囲に入らないクラスの休み・行事は、何も言わずに外す", () => {
    const source = changed((s) => {
      s.closures.push({
        startDate: "2026-11-30",
        endDate: null,
        name: "終わったクラスの行事",
        className: "もうないクラス",
      });
    });
    const result = buildExport(source);
    expect(result.issues).toEqual([]);
    expect(result.files!.map((f) => f.content).join("")).not.toContain(
      "終わったクラスの行事",
    );
  });
});

describe("buildExport: 書き出し前の確認 (R5-6)", () => {
  it("1: ホームルーム教室が無効(または、教室マスタにない)", () => {
    const room = (s: ExportSource) =>
      s.rooms.find((r) => r.name === s.classes[0].homeRoom)!;
    const inactive = changed((s) => {
      room(s).active = false;
    });
    expect(errorsOf(inactive).map((i) => i.check)).toContain(1);
    const missing = changed((s) => {
      s.classes[0].homeRoom = "ない教室";
    });
    expect(errorsOf(missing).map((i) => i.check)).toContain(1);
    expect(buildExport(inactive).files).toBeNull();
  });

  it("2: 同じ年度のクラスで、ホームルーム教室が重なる", () => {
    const source = changed((s) => {
      s.classes[1].homeRoom = s.classes[0].homeRoom;
    });
    const errors = errorsOf(source).filter((i) => i.check === 2);
    expect(errors).toHaveLength(1);
    expect(errors[0].target).toContain(source.classes[0].name);
    expect(errors[0].target).toContain(source.classes[1].name);
  });

  it("3: クラスの教科に、講師の行がない(「各担当」の行でもよい)", () => {
    const source = changed((s) => {
      s.classes[0].teachers.pop();
    });
    const errors = errorsOf(source).filter((i) => i.check === 3);
    expect(errors).toHaveLength(1);
    expect(errors[0].target).toBe(source.classes[0].name);
  });

  it("4: 講師・教室の行の(クラス, 教科)が、クラスの教科にない", () => {
    const source = changed((s) => {
      s.classes[0].subjects.pop();
    });
    const checks = errorsOf(source).map((i) => i.check);
    expect(checks).toContain(4);
  });

  it("5: 紐づけが、無効な講師・教科・教室を指している", () => {
    const teacher = changed((s) => {
      const name = s.classes[0].teachers.find(
        (t) => t.teacherName,
      )!.teacherName;
      s.teachers.find((t) => t.displayName === name)!.active = false;
    });
    expect(errorsOf(teacher).map((i) => i.check)).toContain(5);
    const subject = changed((s) => {
      s.subjects.find((x) => x.name === s.classes[0].subjects[0])!.active =
        false;
    });
    expect(errorsOf(subject).map((i) => i.check)).toContain(5);
    const room = changed((s) => {
      const name = s.classes[0].rooms.find((r) => r.roomName)!.roomName;
      s.rooms.find((r) => r.name === name)!.active = false;
    });
    expect(errorsOf(room).map((i) => i.check)).toContain(5);
  });

  it("6: 休み・行事は200行まで。180行を超えたら警告だけ(書き出せる)", () => {
    const rows = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        startDate: `2026-${String(4 + Math.floor(i / 28)).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
        endDate: null,
        name: `行事${i}`,
        className: null,
      }));
    const warn = buildExport(
      changed((s) => {
        s.closures = rows(181);
      }),
    );
    expect(warn.issues.map((i) => [i.level, i.check])).toEqual([
      ["warning", 6],
    ]);
    expect(warn.files).not.toBeNull();
    const limit = buildExport(
      changed((s) => {
        s.closures = rows(200);
      }),
    );
    expect(limit.files).not.toBeNull();
    const over = buildExport(
      changed((s) => {
        s.closures = rows(201);
      }),
    );
    expect(
      over.issues.filter((i) => i.level === "error").map((i) => i.check),
    ).toEqual([6]);
    expect(over.files).toBeNull();
  });

  it("7: マスタは100行、紐づけは1,000行まで", () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        displayName: `講師${i}`,
        active: true,
      }));
    // Every subject gets one 各担当 row, so no teacher of the demo data is needed.
    const anyTeacher = (s: ExportSource) =>
      s.classes.forEach((c) => {
        c.teachers = c.subjects.map((subjectName) => ({
          subjectName,
          teacherName: null,
        }));
      });
    const ok = buildExport(
      changed((s) => {
        s.teachers = many(100);
        anyTeacher(s);
      }),
    );
    expect(ok.issues).toEqual([]);
    const over = errorsOf(
      changed((s) => {
        s.teachers = many(101);
        anyTeacher(s);
      }),
    );
    expect(over.map((i) => [i.check, i.target])).toEqual([
      [7, MASTER_FILES.teachers],
    ]);
    const links = errorsOf(
      changed((s) => {
        s.classes[0].rooms = Array.from({ length: 1001 }, (_, i) => ({
          subjectName: s.classes[0].subjects[0],
          roomName: `ない教室${i}`,
        }));
        s.rooms.push(
          ...Array.from({ length: 1001 }, (_, i) => ({
            name: `ない教室${i}`,
            building: null,
            kind: "FREE" as const,
            note: null,
            active: true,
          })),
        );
      }),
    );
    expect(
      links.some(
        (i) => i.check === 7 && i.target === MASTER_FILES.subjectRooms,
      ),
    ).toBe(true);
  });

  it("空のファイルは、ツールが受け付けないので止める", () => {
    const noClosures = errorsOf(
      changed((s) => {
        s.closures = [];
      }),
    );
    expect(noClosures.map((i) => [i.check, i.target])).toEqual([
      [null, MASTER_FILES.closures],
    ]);
  });

  it("同じ休み・行事が2行あれば、ツールが受け付けないので止める", () => {
    const source = changed((s) => {
      s.closures.push({ ...s.closures[0] });
    });
    expect(errorsOf(source).map((i) => i.check)).toEqual([null]);
  });

  it("書いたものを読み直して、まだ引っかかるものも止める(外部講師など)", () => {
    const source = changed((s) => {
      s.teachers.push({ displayName: "外部講師", active: true });
    });
    const errors = errorsOf(source);
    expect(errors).toHaveLength(1);
    expect(errors[0].check).toBeNull();
    expect(buildExport(source).files).toBeNull();
  });

  it("エラーがあっても、行数は出す(画面に見せるため)", () => {
    const result = buildExport(
      changed((s) => {
        s.classes[0].teachers.pop();
      }),
    );
    expect(result.files).toBeNull();
    expect(result.rowCounts.classes).toBe(12);
  });
});

describe("ツールの検査の写し(ここが緩いと、上のテストの意味がなくなる)", () => {
  const good = () =>
    buildExport(demoSource()).files!.map((f) => ({
      name: f.name,
      text: f.content,
    }));
  const edit = (key: MasterFileKey, change: (text: string) => string) =>
    good().map((f) =>
      f.name === MASTER_FILES[key] ? { ...f, text: change(f.text) } : f,
    );

  it("正しいファイルでは何も見つけない", () => {
    expect(excelToolProblems(good())).toEqual([]);
  });

  it("見出しだけのファイル、重複、ホームルーム教室の重なり、分類違いを見つける", () => {
    expect(
      excelToolProblems(
        edit("closures", (t) => t.split("\r\n")[0] + "\r\n"),
      ).join(),
    ).toContain("データの行がありません");
    expect(
      excelToolProblems(
        edit("subjects", (t) => t + t.split("\r\n")[1] + "\r\n"),
      ).join(),
    ).toContain("重複");
    expect(
      excelToolProblems(
        edit("classes", (t) =>
          t
            .replace(/,[^,\r\n]+\r\n/, ",201\r\n")
            .replace(/,[^,\r\n]+\r\n/g, ",201\r\n"),
        ),
      ).join(),
    ).toContain("ホームルーム教室");
    expect(
      excelToolProblems(
        edit("rooms", (t) => t.replace("ホームルーム", "HR")),
      ).join(),
    ).toContain("分類");
  });

  it("紐づけがクラスの教科にない行、講師の行がない教科を見つける", () => {
    expect(
      excelToolProblems(
        edit("subjectRooms", (t) => t + "大学併修1年,ない教科,201\r\n"),
      ).join(),
    ).toContain("ない教科");
    const dropFirstTeacherRow = edit("subjectTeachers", (t) => {
      const lines = t.split("\r\n");
      lines.splice(1, 1);
      return lines.join("\r\n");
    });
    expect(excelToolProblems(dropFirstTeacherRow).join()).toContain(
      "の講師が、教科の講師の表にありません",
    );
  });
});

describe("ZIP", () => {
  const files = buildExport(demoSource()).files!;
  const at = new Date("2026-11-06T09:00:00+09:00");

  it("名前は ミエルーム_マスタ_YYYYMMDD.zip", () => {
    expect(masterZipName("2026-11-06")).toBe("ミエルーム_マスタ_20261106.zip");
    expect(masterZipAsciiName("2026-11-06")).toBe(
      "mieroom_masters_20261106.zip",
    );
  });

  it("8つのファイルが、そのままの中身で入る。日本語のファイル名は UTF-8 の印が付く", () => {
    const zip = buildMasterZip(files, at);
    const entries = unzipSync(zip);
    expect(Object.keys(entries).sort()).toEqual(
      files.map((f) => f.name).sort(),
    );
    for (const file of files) {
      expect(
        Buffer.from(entries[file.name]).equals(
          Buffer.from(file.content, "utf8"),
        ),
        file.name,
      ).toBe(true);
      expect([...entries[file.name].slice(0, 3)], file.name).toEqual([
        0xef, 0xbb, 0xbf,
      ]);
    }
    // General purpose flag of the first entry, bit 11 = file names are UTF-8.
    expect((zip[6] | (zip[7] << 8)) & 0x800).toBe(0x800);
  });
});

describe("masterExportRange", () => {
  it("今年度の4/1から、翌年の4/11まで", () => {
    expect(masterExportRange(2026)).toEqual({
      start: "2026-04-01",
      end: "2027-04-11",
    });
    expect(masterExportRange(2027)).toEqual({
      start: "2027-04-01",
      end: "2028-04-11",
    });
  });
});
