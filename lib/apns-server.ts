import "server-only";
import { connect } from "node:http2";
import { createApnsRequestBuilder, apnsResponseResult, type ApnsConfiguration, type ApnsDelivery, type ApnsRequest, type ApnsResponse, type ApnsResult } from "./apns";

/** Closed Apple endpoints only. Never log raw provider errors, payloads, tokens or credentials. */
export async function sendApnsRequest(request: ApnsRequest): Promise<ApnsResponse> {
  if (!["https://api.push.apple.com", "https://api.sandbox.push.apple.com"].includes(request.endpoint)) return { status: 0 };
  return new Promise(resolve => {
    let settled = false, status = 0, requestId: string | undefined, body = "";
    const session = connect(request.endpoint, { minVersion: "TLSv1.2" });
    const finish = (response: ApnsResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      session.destroy();
      resolve(response);
    };
    const timeout = setTimeout(() => finish({ status: 0 }), 8_000);
    session.on("error", () => finish({ status: 0 }));
    session.once("connect", () => {
      if (settled) return;
      try {
        const stream = session.request(request.headers);
        stream.setEncoding("utf8");
        stream.on("response", headers => { status = Number(headers[":status"]) || 0; requestId = typeof headers["apns-id"] === "string" ? headers["apns-id"] : undefined; });
        stream.on("data", chunk => { body += chunk; if (Buffer.byteLength(body) > 4096) finish({ status: 0 }); });
        stream.on("error", () => finish({ status: 0 }));
        stream.on("end", () => {
          let reason: string | undefined, timestamp: number | undefined;
          if (body) {
            try {
              const value: unknown = JSON.parse(body);
              if (!value || typeof value !== "object") return finish({ status: 0 });
              const parsed = value as Record<string, unknown>;
              if (typeof parsed.reason === "string" && /^[A-Za-z]{1,80}$/.test(parsed.reason)) reason = parsed.reason;
              if (typeof parsed.timestamp === "number" && Number.isFinite(parsed.timestamp)) timestamp = parsed.timestamp;
            } catch { return finish({ status: 0 }); }
          }
          finish({ status, requestId, reason, timestamp });
        });
        stream.end(request.body);
      } catch { finish({ status: 0 }); }
    });
  });
}

export function createApnsSender(configuration: ApnsConfiguration, dependencies: { now?: () => number; transport?: typeof sendApnsRequest } = {}) {
  const build = createApnsRequestBuilder(configuration, dependencies.now);
  return async (delivery: ApnsDelivery): Promise<ApnsResult> => {
    const request = build(delivery);
    if (!request) return { kind: "expired" };
    try { return apnsResponseResult(await (dependencies.transport ?? sendApnsRequest)(request), delivery.id.toLowerCase()); }
    catch { return { kind: "retry", retryAfterMs: 60_000 }; }
  };
}
