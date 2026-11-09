import { MESSAGES } from "@/lib/messages";
import { json } from "./admin-request";
import type { LinkResult } from "./links-edit";

/** The answer of the two link routes: short, with the text the screen shows. */
export function linkResponse(result: LinkResult): Response {
  switch (result.kind) {
    case "saved":
      return json(200, { notice: "MI501", exportIssues: result.exportIssues });
    case "invalid":
      return json(400, { message: result.message });
    case "not_found":
      return json(404, { message: MESSAGES.ME902 });
  }
}
