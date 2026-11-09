import { MESSAGES } from "@/lib/messages";
import { json } from "./admin-request";
import type { MasterResult } from "./master-edit";

/** The answer of the two master routes: short, with the text the screen shows. */
export function masterResponse(result: MasterResult): Response {
  switch (result.kind) {
    case "saved":
      return json(200, {
        notice: result.notice,
        renamed: result.renamed,
        exportIssues: result.exportIssues,
      });
    case "invalid":
      return json(400, { errors: result.errors });
    case "conflict":
      return json(409, { message: MESSAGES.ME902 });
    case "not_found":
      return json(404, { message: MESSAGES.ME902 });
  }
}
