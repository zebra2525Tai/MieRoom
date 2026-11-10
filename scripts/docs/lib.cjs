"use strict";
// Shared parts for the submission documents (ミエルーム). A4, 日本語, 表紙・改訂履歴・目次つき。
const fs = require("fs");
const path = require("path");
const D = require("docx");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  TableOfContents,
  VerticalAlign,
  SectionType,
  TabStopType,
} = D;

const FONT = {
  ascii: "Arial",
  hAnsi: "Arial",
  eastAsia: "Yu Gothic",
  cs: "Arial",
};
const MONO = {
  ascii: "Consolas",
  hAnsi: "Consolas",
  eastAsia: "Yu Gothic",
  cs: "Consolas",
};
const PAGE_W = 11906,
  PAGE_H = 16838,
  MARGIN = 1134;
const CONTENT_W = PAGE_W - MARGIN * 2; // 9638
const COLOR = {
  head: "1F3864",
  line: "8EA9DB",
  headFill: "D9E2F3",
  noteFill: "F2F2F2",
  warnFill: "FFF2CC",
  okFill: "E2EFDA",
  text: "222222",
};

// {{名前}} を、集めた数字や日付に置き換える。知らない名前は、間違いを防ぐため止める。
let VARS = {};
const setVars = (v) => {
  VARS = v;
};
const fill = (t) =>
  String(t).replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in VARS)) throw new Error("知らない変数: {{" + k + "}}");
    return String(VARS[k]);
  });

let numberingConfigs = [];
let listCounter = 0;

function newNumbering(format) {
  const ref = "list" + ++listCounter;
  numberingConfigs.push({
    reference: ref,
    levels: [
      {
        level: 0,
        format: format === "bullet" ? LevelFormat.BULLET : LevelFormat.DECIMAL,
        text: format === "bullet" ? "•" : "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 300 } } },
      },
      {
        level: 1,
        format: LevelFormat.BULLET,
        text: "–",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 1000, hanging: 300 } } },
      },
    ],
  });
  return ref;
}

/** `**太字**` と `` `コード` `` を、書式つきの TextRun にする。 */
function runs(text, base = {}) {
  text = fill(text);
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0,
    m;
  while ((m = re.exec(text))) {
    if (m.index > last)
      out.push(
        new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }),
      );
    const tok = m[0];
    if (tok.startsWith("**"))
      out.push(
        new TextRun({
          text: tok.slice(2, -2),
          bold: true,
          font: FONT,
          ...base,
        }),
      );
    else
      out.push(
        new TextRun({
          text: tok.slice(1, -1),
          font: MONO,
          shading: { type: ShadingType.CLEAR, fill: "EDEDED" },
          ...base,
        }),
      );
    last = m.index + tok.length;
  }
  if (last < text.length)
    out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return out;
}

const h1 = (t) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: fill(t), font: FONT })],
  });
const h2 = (t) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: fill(t), font: FONT })],
  });
const h3 = (t) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text: fill(t), font: FONT })],
  });
const p = (t, o = {}) =>
  new Paragraph({
    spacing: { after: 100, line: 300 },
    alignment: o.align,
    children: runs(t, o.run || {}),
  });
const small = (t) => p(t, { run: { size: 18, color: "595959" } });
const bullets = (items) => {
  const ref = newNumbering("bullet");
  return items.map((it) => {
    const lvl = Array.isArray(it) ? 1 : 0;
    const text = Array.isArray(it) ? it[0] : it;
    return new Paragraph({
      numbering: { reference: ref, level: lvl },
      spacing: { after: 50, line: 280 },
      children: runs(text),
    });
  });
};
const numbered = (items) => {
  const ref = newNumbering("number");
  return items.map(
    (it) =>
      new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { after: 60, line: 280 },
        children: runs(it),
      }),
  );
};
const code = (lines) =>
  lines
    .map(
      (l, i) =>
        new Paragraph({
          spacing: { after: 0, line: 260 },
          indent: { left: 240 },
          shading: { type: ShadingType.CLEAR, fill: "F3F3F3" },
          border:
            i === 0
              ? {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: "CCCCCC",
                    space: 2,
                  },
                }
              : undefined,
          children: [
            new TextRun({
              text: l === "" ? " " : fill(l),
              font: MONO,
              size: 18,
            }),
          ],
        }),
    )
    .concat([new Paragraph({ spacing: { after: 100 }, children: [] })]);

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

/** 表。widths は割合(合計は自動で CONTENT_W に合わせる)。 */
function table(headers, rows, widths, opts = {}) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const cols = widths.map((w) => Math.floor((w / sum) * CONTENT_W));
  cols[cols.length - 1] += CONTENT_W - cols.reduce((a, b) => a + b, 0);
  const size = opts.size || 17;
  const cell = (text, i, head, fill) =>
    new TableCell({
      width: { size: cols[i], type: WidthType.DXA },
      borders: BORDERS,
      verticalAlign: VerticalAlign.TOP,
      shading: head
        ? { type: ShadingType.CLEAR, fill: COLOR.headFill }
        : fill
          ? { type: ShadingType.CLEAR, fill }
          : undefined,
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      children: String(text)
        .split("\n")
        .map(
          (line) =>
            new Paragraph({
              spacing: { after: 0, line: 250 },
              children: runs(line, { size, bold: head ? true : undefined }),
            }),
        ),
    });
  const trs = [];
  if (headers)
    trs.push(
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((h, i) => cell(h, i, true)),
      }),
    );
  for (const r of rows) {
    const fill = r.__fill;
    const cells = r.__fill ? r.cells : r;
    trs.push(
      new TableRow({
        cantSplit: true,
        children: cells.map((c, i) => cell(c, i, false, fill)),
      }),
    );
  }
  return [
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: cols,
      rows: trs,
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}
const filled = (cells, fill) => ({ __fill: fill, cells });

/** 補足・注意の囲み。 */
function note(text, kind = "info") {
  const fill =
    kind === "warn"
      ? COLOR.warnFill
      : kind === "ok"
        ? COLOR.okFill
        : COLOR.noteFill;
  const label =
    kind === "warn" ? "注意  " : kind === "ok" ? "確認済み  " : "補足  ";
  return new Paragraph({
    spacing: { before: 60, after: 140, line: 280 },
    indent: { left: 120, right: 120 },
    shading: { type: ShadingType.CLEAR, fill },
    border: {
      left: {
        style: BorderStyle.SINGLE,
        size: 24,
        color: kind === "warn" ? "BF9000" : kind === "ok" ? "548235" : "7F7F7F",
        space: 8,
      },
    },
    children: [
      new TextRun({ text: label, bold: true, font: FONT, size: 20 }),
      ...runs(text, { size: 20 }),
    ],
  });
}

/** 画面写真を入れる場所の印(撮影して差し替える)。 */
const figure = (label) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 160 },
    shading: { type: ShadingType.CLEAR, fill: "FAFAFA" },
    border: {
      top: { style: BorderStyle.DASHED, size: 6, color: "A6A6A6", space: 8 },
      bottom: { style: BorderStyle.DASHED, size: 6, color: "A6A6A6", space: 8 },
      left: { style: BorderStyle.DASHED, size: 6, color: "A6A6A6", space: 8 },
      right: { style: BorderStyle.DASHED, size: 6, color: "A6A6A6", space: 8 },
    },
    children: [
      new TextRun({
        text: "【画面写真を挿入】 " + label,
        font: FONT,
        size: 18,
        color: "7F7F7F",
      }),
    ],
  });

const spacer = (n = 1) =>
  Array.from({ length: n }, () => new Paragraph({ children: [] }));
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

/** 表紙(別セクション。ヘッダー・フッターなし)。 */
function cover(meta) {
  const info = [
    ["文書番号", meta.no],
    ["版", meta.version],
    ["作成日", meta.date],
    ["作成者", meta.author || "(氏名を記入)"],
    ["所属", meta.org || "(学校名・学科を記入)"],
  ];
  const kids = [
    ...spacer(5),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "卒業制作",
          font: FONT,
          size: 28,
          color: "595959",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "ミエルーム(MieRoom)",
          font: FONT,
          size: 36,
          bold: true,
          color: COLOR.head,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 300, after: 200 },
      border: {
        top: {
          style: BorderStyle.SINGLE,
          size: 12,
          color: COLOR.head,
          space: 14,
        },
        bottom: {
          style: BorderStyle.SINGLE,
          size: 12,
          color: COLOR.head,
          space: 14,
        },
      },
      children: [
        new TextRun({
          text: meta.title,
          font: FONT,
          size: 52,
          bold: true,
          color: COLOR.head,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 600 },
      children: [
        new TextRun({
          text: meta.subtitle || "",
          font: FONT,
          size: 24,
          color: "595959",
        }),
      ],
    }),
    ...spacer(2),
    new Table({
      width: { size: 6000, type: WidthType.DXA },
      columnWidths: [1800, 4200],
      rows: info.map(
        ([k, v]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 1800, type: WidthType.DXA },
                borders: BORDERS,
                shading: { type: ShadingType.CLEAR, fill: COLOR.headFill },
                margins: { top: 70, bottom: 70, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: k,
                        font: FONT,
                        size: 20,
                        bold: true,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 4200, type: WidthType.DXA },
                borders: BORDERS,
                margins: { top: 70, bottom: 70, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: v, font: FONT, size: 20 })],
                  }),
                ],
              }),
            ],
          }),
      ),
    }),
  ];
  return kids;
}

/** 改訂履歴 + 目次。 */
function front(meta) {
  return [
    new Paragraph({
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({
          text: "改訂履歴",
          font: FONT,
          size: 30,
          bold: true,
          color: COLOR.head,
        }),
      ],
    }),
    ...table(
      ["版", "日付", "内容", "作成者"],
      [
        [
          meta.version,
          meta.date,
          meta.revision || "初版",
          meta.author || "(氏名を記入)",
        ],
      ],
      [8, 14, 56, 22],
    ),
    new Paragraph({
      spacing: { before: 200, after: 160 },
      children: [
        new TextRun({
          text: "目次",
          font: FONT,
          size: 30,
          bold: true,
          color: COLOR.head,
        }),
      ],
    }),
    new TableOfContents("目次", { hyperlink: true, headingStyleRange: "1-2" }),
    small(
      "※ 目次は、Word で開いたときに「フィールドを更新しますか」と出たら「はい」を選ぶと、ページ番号つきで表示されます。",
    ),
    pageBreak(),
  ];
}

const styles = {
  default: { document: { run: { font: FONT, size: 21, color: COLOR.text } } },
  paragraphStyles: [
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT, size: 32, bold: true, color: COLOR.head },
      paragraph: {
        spacing: { before: 360, after: 160 },
        keepNext: true,
        outlineLevel: 0,
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 8,
            color: COLOR.line,
            space: 4,
          },
        },
      },
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT, size: 26, bold: true, color: COLOR.head },
      paragraph: {
        spacing: { before: 260, after: 110 },
        keepNext: true,
        outlineLevel: 1,
      },
    },
    {
      id: "Heading3",
      name: "Heading 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT, size: 22, bold: true, color: "2F5496" },
      paragraph: {
        spacing: { before: 200, after: 80 },
        keepNext: true,
        outlineLevel: 2,
      },
    },
  ],
};

/** 文書を作って書き出す。body は Paragraph / Table の配列。 */
async function build(meta, body, outDir) {
  const doc = new Document({
    creator: meta.author || "ミエルーム",
    title: `${meta.title} - ミエルーム`,
    description: meta.subtitle || "",
    styles,
    features: { updateFields: true },
    numbering: { config: numberingConfigs },
    sections: [
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: {
              top: MARGIN * 1.3,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
            },
          },
        },
        children: cover(meta),
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: 1400, bottom: 1200, left: MARGIN, right: MARGIN },
            pageNumbers: { start: 1 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: "BFBFBF",
                    space: 4,
                  },
                },
                children: [
                  new TextRun({
                    text: `ミエルーム  ${meta.title}`,
                    font: FONT,
                    size: 17,
                    color: "595959",
                  }),
                  new TextRun({
                    text: `\t${meta.no}  版 ${meta.version}`,
                    font: FONT,
                    size: 17,
                    color: "595959",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [
                      "- ",
                      PageNumber.CURRENT,
                      " / ",
                      PageNumber.TOTAL_PAGES,
                      " -",
                    ],
                    font: FONT,
                    size: 17,
                    color: "595959",
                  }),
                ],
              }),
            ],
          }),
        },
        children: [...front(meta), ...body.flat(Infinity)],
      },
    ],
  });
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, meta.file);
  fs.writeFileSync(file, await Packer.toBuffer(doc));
  numberingConfigs = [];
  listCounter = 0;
  return file;
}

module.exports = {
  setVars,
  figure,
  h1,
  h2,
  h3,
  p,
  small,
  bullets,
  numbered,
  code,
  table,
  filled,
  note,
  spacer,
  pageBreak,
  build,
  CONTENT_W,
};
