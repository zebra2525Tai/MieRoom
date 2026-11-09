import { MESSAGES } from "./messages";

// "What was just done" (MI) that a screen shows after an operation. The id comes in the address,
// so only the ones listed here are accepted; anything else shows nothing.
const NOTICES: Record<string, string> = {
  MI101: MESSAGES.MI101,
  MI102: MESSAGES.MI102,
  MI201: MESSAGES.MI201,
  MI202: MESSAGES.MI202,
  MI203: MESSAGES.MI203,
  MI204: MESSAGES.MI204,
  MI301: MESSAGES.MI301,
  MI302: MESSAGES.MI302,
  MI501: MESSAGES.MI501,
  MI502: MESSAGES.MI502,
  MI502on: MESSAGES.MI502on,
  MI503: MESSAGES.MI503,
};

export function noticeText(id: string | undefined): string | null {
  return id !== undefined && Object.hasOwn(NOTICES, id) ? NOTICES[id] : null;
}

/** A page number from the address: 1 or more, otherwise 1. */
export function pageNumber(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}
