export type GenieErrorCode = "invalid_request" | "search_unresolved" | "unsafe_input" | "rate_limited" | "unavailable" | "timeout" | "failed";
export class GenieError extends Error {
  readonly code: GenieErrorCode;
  readonly status: number;
  constructor(code: GenieErrorCode, status: number) { super(code); this.code = code; this.status = status; }
}
