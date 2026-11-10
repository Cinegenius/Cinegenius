const browserErrorNames = new Set([
  "TypeError", "SyntaxError", "ReferenceError", "RangeError", "URIError", "EvalError",
  "DOMException", "AbortError", "NetworkError", "TimeoutError", "SecurityError",
  "NotAllowedError", "NotReadableError", "NotSupportedError", "InvalidStateError",
  "InvalidCharacterError", "DataCloneError", "QuotaExceededError", "EncodingError",
  "OperationError", "UnknownError", "DataError", "IndexSizeError",
]);

const browserErrorMessage = /^(?:TypeError|SyntaxError|ReferenceError|RangeError|URIError|EvalError|DOMException|AbortError|NetworkError):(?:\s|$)/;
const transportMessage = /^(?:failed to fetch(?: resource)?|fetch failed|load failed|network request failed|networkerror(?: when attempting to fetch resource\.?)?|the (?:operation|request) was aborted\.?|the user aborted a request\.?|the string did not match the expected pattern\.?|unexpected (?:end of json input|token\b.*)|json\.parse\b.*|failed to execute\b.*)$/i;
const httpMessage = /^(?:HTTP(?:\/\d(?:\.\d)?)?\s*[:_-]?\s*[1-5]\d{2}(?:\s+[^\r\n]*)?|request failed with status(?: code)?\s*[:_-]?\s*[1-5]\d{2}|[1-5]\d{2})$/i;
const machineCode = /^(?:[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+|[A-Z][A-Z0-9]*(?:[:.-][A-Z0-9]+)+|(?:auth|storage|database|clerk|supabase|api|http|network)[/:.][A-Za-z0-9_./:-]+|PGRST[A-Z0-9]+|E(?:CONNRESET|CONNREFUSED|CONNABORTED|NOTFOUND|PIPE|TIMEDOUT|HOSTUNREACH|NETUNREACH)|23505|23503|23502|42501|22001|P0001|UNAUTHORIZED|FORBIDDEN|CONFLICT|ERROR|FAILED|ABORTED|TIMEOUT)$/;

/** Keep readable API/business copy intact; callers provide the current locale's fallback. */
export function uiErrorMessage(error: unknown, fallback: string): string {
  let message: unknown;
  let name: unknown;
  try {
    if (typeof error === "string") {
      message = error;
    } else if (error && typeof error === "object") {
      if (typeof DOMException !== "undefined" && error instanceof DOMException) return fallback;
      const details = error as { message?: unknown; name?: unknown };
      message = details.message;
      name = details.name;
    }
  } catch {
    return fallback;
  }

  if (typeof name === "string" && browserErrorNames.has(name)) return fallback;
  if (typeof message !== "string" || !message.trim()) return fallback;
  const candidate = message.trim();
  if (browserErrorMessage.test(candidate) || transportMessage.test(candidate) || httpMessage.test(candidate) || machineCode.test(candidate)) return fallback;
  return message;
}
