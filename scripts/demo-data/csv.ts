// CSV reading and writing for the demo data (外部設計書 08章 8-1).
// Output: UTF-8 with BOM, comma separated, CRLF, quotes only where needed.

const BOM = "﻿";

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function writeCsv(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((row) => row.map(quote).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Reads a CSV text into rows of cells. Accepts BOM, CRLF or LF, and quoted cells. */
export function readCsv(text: string): string[][] {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((items) => !(items.length === 1 && items[0] === ""));
}
