import {NextRequest, NextResponse} from "next/server";
import {db} from "@/lib/db";
import {requireEditorialAgent, editorialOrganizationAllowed, editorialHeaders} from "@/lib/editorial-agent-server";
import {NEWS_READERSHIP_CONTRACT, NEWS_READERSHIP_THRESHOLDS, readershipWindow, readershipSignals} from "@/lib/news-readership";
import {readNewsReadership} from "@/lib/news-readership-server";

export async function GET(request: NextRequest) {
  const actor = await requireEditorialAgent(request);
  if (actor instanceof NextResponse) return actor;
  const organizationId = request.nextUrl.searchParams.get("organizationId") ?? "";
  if (!await editorialOrganizationAllowed(organizationId)) return NextResponse.json({error: "editorial_forbidden"}, {status: 403, headers: editorialHeaders});
  const afterId = request.nextUrl.searchParams.get("afterId");
  if (afterId && !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(afterId)) return NextResponse.json({error: "editorial_cursor"}, {status: 400, headers: editorialHeaders});
  let query = db.from("organization_entries").select("id,topic,published_at,created_at,organization:organizations!inner(moderation_status)")
    .eq("organization_id", organizationId).in("moderation_status", ["approved", "ended"]).eq("organization.moderation_status", "approved").order("id").limit(101);
  if (afterId) query = query.gt("id", afterId);
  const {data, error} = await query;
  if (error) return NextResponse.json({error: "editorial_unavailable"}, {status: 503, headers: editorialHeaders});
  const entries = (data ?? []).slice(0, 100), window = readershipWindow();
  const base = {contract: NEWS_READERSHIP_CONTRACT, window, thresholds: NEWS_READERSHIP_THRESHOLDS,
    coverage: "consenting_visits_only", metric: "observations_not_people", nextCursor: (data ?? []).length > 100 ? entries.at(-1)!.id : null};
  if (!entries.length) return NextResponse.json({...base, status: "cold_start", entries: []}, {headers: editorialHeaders});
  const counts = await readNewsReadership(entries.map(row => row.id), window);
  if (!counts) return NextResponse.json({...base, status: "unavailable", entries: []}, {status: 503, headers: editorialHeaders});
  // Recheck current authorization and publication after the provider/cache read.
  if (!await editorialOrganizationAllowed(organizationId)) return NextResponse.json({error: "editorial_forbidden"}, {status: 403, headers: editorialHeaders});
  const {data: visible, error: visibleError} = await db.from("organization_entries").select("id,topic,published_at,created_at,organization:organizations!inner(moderation_status)")
    .eq("organization_id", organizationId).in("id", entries.map(row => row.id)).in("moderation_status", ["approved", "ended"]).eq("organization.moderation_status", "approved");
  if (visibleError) return NextResponse.json({...base, status: "unavailable", entries: []}, {status: 503, headers: editorialHeaders});
  const signals = readershipSignals(visible ?? [], counts);
  return NextResponse.json({...base, status: signals.some(row => row.learningEligible) ? "ready" : signals.some(row => row.state !== "cold_start") ? "insufficient_data" : "cold_start", entries: signals}, {headers: editorialHeaders});
}
