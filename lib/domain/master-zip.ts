import { strToU8, zipSync } from "fflate";
import type { ExportFile } from "./master-export";

// The 8 files in one ZIP (外部設計書 08章 8-3: ミエルーム_マスタ_YYYYMMDD.zip).

/** `date` is a school date (YYYY-MM-DD, Japan time). */
export function masterZipName(date: string): string {
  return `ミエルーム_マスタ_${date.replaceAll("-", "")}.zip`;
}

/** The same name in plain ASCII, for browsers that read only `filename=`. */
export function masterZipAsciiName(date: string): string {
  return `mieroom_masters_${date.replaceAll("-", "")}.zip`;
}

export function buildMasterZip(files: ExportFile[], at: Date): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file.name] = strToU8(file.content);
  // fflate marks names that are not ASCII as UTF-8 inside the ZIP.
  return zipSync(entries, { level: 6, mtime: at });
}
