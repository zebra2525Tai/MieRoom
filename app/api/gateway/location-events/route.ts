import type { NextRequest } from "next/server";
import {
  gatewayEventSchema,
  MAX_EVENT_BYTES,
} from "@/lib/domain/gateway-event";
import {
  applyLocationEvent,
  gatewayConfig,
  isDatabaseUnavailable,
  type LocationOutcome,
} from "@/lib/server/gateway";
import { authenticateGateway } from "@/lib/server/gateway-auth";

// IF01 (依頼文書: 教員位置情報連携 API 要件定義メモ): the gateway on the school PC sends each
// change of a teacher's position or state. Answers are JSON of one shape, and say nothing of
// the key, the database or the code. Only 200 to 299 counts as sent for the gateway, so what
// can never succeed on a retry (an unknown teacher or room) is answered 200 with a reason.

type ErrorCode =
  | "invalid_json"
  | "invalid_request_body"
  | "gateway_id_mismatch"
  | "unauthorized"
  | "gateway_disabled"
  | "payload_too_large"
  | "database_unavailable"
  | "internal_server_error";

const STATUS: Record<ErrorCode, number> = {
  invalid_json: 400,
  invalid_request_body: 400,
  gateway_id_mismatch: 400,
  unauthorized: 401,
  gateway_disabled: 403,
  payload_too_large: 413,
  database_unavailable: 503,
  internal_server_error: 500,
};

function respond(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

const failure = (error: ErrorCode) =>
  respond(STATUS[error], { success: false, error });

/** One line for the log (12.1). Never the key, the Authorization header, a teacher or a room. */
function log(fields: Record<string, unknown>) {
  console.info(JSON.stringify({ at: "gateway.location-events", ...fields }));
}

function success(outcome: LocationOutcome, eventId: string): Response {
  switch (outcome.kind) {
    case "updated":
      return respond(200, {
        success: true,
        duplicate: false,
        currentLocationUpdated: true,
        eventId,
      });
    case "duplicate":
      return respond(200, { success: true, duplicate: true, eventId });
    case "older_event":
      return respond(200, {
        success: true,
        duplicate: false,
        currentLocationUpdated: false,
        reason: "older_event",
        eventId,
      });
    case "ignored":
      return respond(200, {
        success: true,
        duplicate: false,
        currentLocationUpdated: false,
        reason: outcome.reason,
        eventId,
      });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const started = Date.now();
  const done = (response: Response, fields: Record<string, unknown> = {}) => {
    log({ status: response.status, ms: Date.now() - started, ...fields });
    return response;
  };

  // 1. Who is asking. Nothing is read and nothing is written before this passes.
  let auth: ReturnType<typeof authenticateGateway>;
  try {
    auth = authenticateGateway(request.headers, gatewayConfig());
  } catch {
    // The deployment's settings are broken: nothing is said about which.
    return done(failure("internal_server_error"));
  }
  if (auth === "disabled") return done(failure("gateway_disabled"));
  if (auth === "unauthorized") return done(failure("unauthorized"));

  // 2. The size, before the body is read, and again after.
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_EVENT_BYTES) return done(failure("payload_too_large"));
  if (
    !(request.headers.get("content-type") ?? "").startsWith("application/json")
  ) {
    return done(failure("invalid_request_body"));
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_EVENT_BYTES) {
    return done(failure("payload_too_large"));
  }

  // 3. The body.
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return done(failure("invalid_json"));
  }
  const parsed = gatewayEventSchema.safeParse(json);
  if (!parsed.success) return done(failure("invalid_request_body"));
  const event = parsed.data;
  if (event.gatewayId !== request.headers.get("x-gateway-id")) {
    return done(failure("gateway_id_mismatch"));
  }

  // 4. Save.
  try {
    const outcome = await applyLocationEvent(event, new Date());
    return done(success(outcome, event.eventId), {
      eventId: event.eventId,
      gatewayId: event.gatewayId,
      eventType: event.eventType,
      state: event.status,
      outcome: outcome.kind === "ignored" ? outcome.reason : outcome.kind,
    });
  } catch (error) {
    // The kind of error only: what the error says may name the database or an address.
    const unavailable = isDatabaseUnavailable(error);
    console.error(
      "gateway location event failed",
      error instanceof Error ? error.name : "unknown",
    );
    return done(
      failure(unavailable ? "database_unavailable" : "internal_server_error"),
      { eventId: event.eventId, gatewayId: event.gatewayId },
    );
  }
}
