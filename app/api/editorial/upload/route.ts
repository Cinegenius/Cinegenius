import { NextRequest, NextResponse } from "next/server";
import { requireEditorialAgent, editorialHeaders, editorialOrganizationAllowed } from "@/lib/editorial-agent-server";
import { validateUpload, buildStoragePath } from "@/lib/uploadGuard";
import { storeProtectedMedia } from "@/lib/protected-media-server";

export async function POST(request: NextRequest) {
  const actor = await requireEditorialAgent(request);
  if (actor instanceof NextResponse) return actor;
  const form = await request.formData().catch(() => null);
  const org = form?.get("organizationId");
  if (typeof org !== "string" || !await editorialOrganizationAllowed(org)) return NextResponse.json({ error: "editorial_forbidden" }, { status: 403, headers: editorialHeaders });
  const file = form?.get("file"), uploadId = form?.get("upload_id");
  if (!(file instanceof File) || typeof uploadId !== "string" || !/^[a-f0-9]{32}$/i.test(uploadId)) return NextResponse.json({ error: "editorial_required" }, { status: 400, headers: editorialHeaders });
  const validation = await validateUpload(file, { emptyMessage: "empty", tooLargeMessage: "too_large", unsupportedTypeMessage: "invalid_type" });
  if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: validation.status, headers: editorialHeaders });
  try {
    const path = buildStoragePath(actor.userId, validation.ext, undefined, uploadId);
    const url = await storeProtectedMedia(actor.userId, path, validation.buffer, validation.mime);
    return NextResponse.json({ url }, { headers: editorialHeaders });
  } catch { return NextResponse.json({ error: "editorial_unavailable" }, { status: 503, headers: editorialHeaders }); }
}
