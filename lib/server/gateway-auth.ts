import { createHash, timingSafeEqual } from "node:crypto";

// Who may send location events: the gateway with the shared key and the registered id.
// Pure (the configuration is passed in), so that every case can be tested.

export type GatewayConfig = { apiKey: string; gatewayId: string };

/** "disabled": the key or the id is not set on this deployment, so nobody may send. */
export type GatewayAuth = "ok" | "unauthorized" | "disabled";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares through a hash, so that the time taken does not show how much matched. */
function sameSecret(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

export function authenticateGateway(
  headers: Headers,
  config: GatewayConfig,
): GatewayAuth {
  if (config.apiKey === "" || config.gatewayId === "") return "disabled";
  const authorization = headers.get("authorization") ?? "";
  const match = /^Bearer (\S+)$/.exec(authorization);
  const keyOk = match !== null && sameSecret(match[1], config.apiKey);
  const idOk = sameSecret(headers.get("x-gateway-id") ?? "", config.gatewayId);
  // Both are always compared, so that the answer does not say which one was wrong.
  return keyOk && idOk ? "ok" : "unauthorized";
}
