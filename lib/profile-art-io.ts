/** Bounded server I/O shared by the dormant platform-art adapters. */
export class ArtPipelineError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; this.name = "ArtPipelineError"; }
}
export async function withArtDeadline<T>(operation: (signal: AbortSignal) => PromiseLike<T>, parent: AbortSignal | undefined, milliseconds: number): Promise<T> {
  const controller = new AbortController();
  let rejectDeadline!: (reason: Error) => void;
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
  const cancel = () => { controller.abort(); rejectDeadline(new ArtPipelineError("interrupted")); };
  const timer = setTimeout(cancel, milliseconds);
  parent?.addEventListener("abort", cancel, { once: true });
  try {
    if (parent?.aborted) throw new ArtPipelineError("interrupted");
    return await Promise.race([Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new ArtPipelineError("interrupted");
      return operation(controller.signal);
    }), deadline]);
  } finally { clearTimeout(timer); parent?.removeEventListener("abort", cancel); }
}
export async function readArtStream(stream: ReadableStream<Uint8Array> | null, maximum: number, signal: AbortSignal): Promise<Uint8Array> {
  if (!stream) throw new ArtPipelineError("missing_body");
  const reader = stream.getReader(), chunks: Uint8Array[] = [];
  let total = 0, count = 0;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      if (signal.aborted) throw new ArtPipelineError("interrupted");
      const { done, value } = await reader.read();
      if (done) break;
      if (++count > 4096) throw new ArtPipelineError("body_too_large");
      total += value.byteLength;
      if (total > maximum) throw new ArtPipelineError("body_too_large");
      chunks.push(value);
    }
    if (signal.aborted) throw new ArtPipelineError("interrupted");
    const result = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } finally { signal.removeEventListener("abort", cancel); cancel(); }
}
