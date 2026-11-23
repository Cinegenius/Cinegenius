/** Bound setup reads AND response bodies. No automatic retry: a timed-out
 * write may already have succeeded, so callers retain their saved request key. */
export function fetchSetup(input: RequestInfo | URL, init: RequestInit = {}, request: typeof fetch = fetch, timeoutMs = 20_000): Promise<Response> {
  const deadline = AbortSignal.timeout(timeoutMs);
  return request(input, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
  });
}
