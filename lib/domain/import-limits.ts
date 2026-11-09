// 時間割の取り込みの上限 (08章 8-2, S20). Kept apart so that the screen can use it without
// the CSV reader.

export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 1024 * 1024;
/** The total is ours: the host accepts a request of about 4.5 MB. */
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
