// タグIDと受信機IDの規則 (外部設計書 S25, R7, IF01). No I/O here.

/** The minor of an iBeacon is 16 bits (0〜65535). */
export const TAG_ID_MAX = 65535;
/** The roomId the gateway sends is 1〜64 characters. */
export const RECEIVER_ID_MAX_LENGTH = 64;

export type IdCheck =
  | { ok: true; value: string }
  | { ok: false; code: "ME501" | "ME513" | "ME514" };

/** Full-width letters and digits become half-width; the surrounding spaces go (6-3). */
export const clean = (text: string) => text.normalize("NFKC").trim();

/**
 * タグID of a 講師: the minor of the tag, a whole number. It is stored the way the gateway's
 * number reads as text ("12", not "012"), because the server looks the tag up by that text.
 * An empty text is `ok` with `null` in the caller: it removes the tag. Here empty is ME501.
 */
export function normalizeTagId(text: string): IdCheck {
  const value = clean(text);
  if (value === "") return { ok: false, code: "ME501" };
  if (!/^\d{1,5}$/.test(value)) return { ok: false, code: "ME513" };
  const number = Number(value);
  if (number > TAG_ID_MAX) return { ok: false, code: "ME513" };
  return { ok: true, value: String(number) };
}

/**
 * 受信機ID: what the gateway sends as roomId ("304"). Letters, digits and . _ - only, so that
 * it can be written in a log or an address safely; 64 characters at most.
 */
export function normalizeReceiverId(text: string): IdCheck {
  const value = clean(text);
  if (value === "") return { ok: false, code: "ME501" };
  if (
    value.length > RECEIVER_ID_MAX_LENGTH ||
    !/^[A-Za-z0-9._-]+$/.test(value)
  ) {
    return { ok: false, code: "ME514" };
  }
  return { ok: true, value };
}
