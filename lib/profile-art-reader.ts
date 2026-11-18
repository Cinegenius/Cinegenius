import { parseProfileArtPublicPath, validArtReadDescriptor, type PlatformArtKind } from "@/lib/profile-art-refill-contract";
import { artBytesSHA256, isWebPContainer } from "@/lib/profile-art-storage";
import { withArtDeadline } from "@/lib/profile-art-io";

export type ArtReaderDependencies = {
  descriptor(kind: PlatformArtKind, mediaKey: string, signal: AbortSignal): Promise<unknown>;
  read(kind: PlatformArtKind, mediaKey: string, signal: AbortSignal): Promise<Uint8Array>;
};
const headers = {"Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"};
const absent = () => new Response(null, {status: 404, headers});

export async function readProfileArtResponse(request: Request, deps: ArtReaderDependencies | null, enabled = false): Promise<Response> {
  if (!enabled || !deps || !["GET", "HEAD"].includes(request.method)) return absent();
  const url = new URL(request.url), parsed = parseProfileArtPublicPath(url.pathname);
  if (!parsed || url.search || url.hash) return absent();
  try {
    return await withArtDeadline(async signal => {
      const descriptor = await deps.descriptor(parsed.kind, parsed.mediaKey, signal);
      if (!validArtReadDescriptor(descriptor) || descriptor.kind !== parsed.kind || descriptor.mediaKey !== parsed.mediaKey) return absent();
      const bytes = await deps.read(parsed.kind, parsed.mediaKey, signal);
      if (bytes.length !== descriptor.byteLength || !isWebPContainer(bytes) || artBytesSHA256(bytes) !== descriptor.sha256) return absent();
      // Recheck withdrawal/quarantine after storage I/O, before releasing any bytes.
      const current = await deps.descriptor(parsed.kind, parsed.mediaKey, signal);
      if (!validArtReadDescriptor(current) || current.kind !== descriptor.kind || current.mediaKey !== descriptor.mediaKey || current.sha256 !== descriptor.sha256 || current.byteLength !== descriptor.byteLength) return absent();
      return new Response(request.method === "HEAD" ? null : new Uint8Array(bytes), {headers: {...headers, "Content-Type": "image/webp", "Content-Length": String(bytes.length)}});
    }, request.signal, 20_000);
  } catch { return absent(); }
}
