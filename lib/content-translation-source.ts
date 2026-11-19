import "server-only";
import { db } from "@/lib/db";
import { profileAccessFor } from "@/lib/profile-privacy-server";
import { projectRecordWithDetails } from "@/lib/project-record";
import { publicTranslationFields, type ContentReference, type TranslationSource } from "@/lib/content-translation";

/** Read current public source before every cache lookup and again before serialization.
 * Owner/friend access does not grant permission to send a private text to external AI.
 * Never accept client prose, table names, URLs or private projections.
 */
export async function translationSource(ref: ContentReference, viewerId: string | null, signal: AbortSignal): Promise<TranslationSource | null> {
  signal.throwIfAborted();
  let row: Record<string, unknown> | null = null;
  let owner: string | null = null;
  let names: string[] = [];
  if (ref.kind === "news") {
    const result = await db.from("organization_entries").select("title,summary,description,organization:organizations!inner(name,moderation_status)")
      .eq("id", ref.id).in("moderation_status", ["approved", "ended"]).eq("organization.moderation_status", "approved").abortSignal(signal).maybeSingle();
    if (result.error) throw new Error("source_unavailable");
    row = result.data;
    const org = result.data?.organization as unknown as {name?: string} | undefined;
    names = org?.name ? [org.name] : [];
  } else if (ref.kind === "organization") {
    const result = await db.from("organizations").select("description,name").eq("id", ref.id).eq("moderation_status", "approved").abortSignal(signal).maybeSingle();
    if (result.error) throw new Error("source_unavailable"); row = result.data;
    names = result.data?.name ? [result.data.name] : [];
  } else if (ref.kind === "listing") {
    const result = await db.from("privacy_visible_listings")
      .select("title,description,type,user_id,company_id,metadata").eq("id", ref.id).eq("published", true).abortSignal(signal).maybeSingle();
    if (result.error) throw new Error("source_unavailable");
    if (result.data) {
      const metadata = result.data.metadata as Record<string, unknown> | null;
      row = {...result.data};
      for (const key of ["access_notes", "availability_notes", "special_skills"]) row[key] = metadata?.[key];
      // An animal's title is its name, not an advertising headline.
      if (result.data.type === "animal") { names = [result.data.title]; delete row.title; }
      owner = result.data.user_id;
    }
  } else if (ref.kind === "company") {
    const result = await db.from("companies").select("name,description,tagline,bio_short,usp,owner_user_id")
      .eq("id", ref.id).eq("published", true).abortSignal(signal).maybeSingle();
    if (result.error) throw new Error("source_unavailable"); row = result.data;
    if (result.data) { names = [result.data.name]; owner = result.data.owner_user_id; }
  } else if (ref.kind === "profile") {
    const [publicAccess, viewerAccess] = await Promise.all([
      profileAccessFor([ref.id], null, {signal, throwOnError: true}),
      profileAccessFor([ref.id], viewerId, {signal, throwOnError: true}),
    ]);
    if (!publicAccess.get(ref.id)?.profile || !viewerAccess.get(ref.id)?.profile) return null;
    const result = await db.from("profiles").select("bio,tagline,display_name").eq("user_id", ref.id).abortSignal(signal).maybeSingle();
    if (result.error) throw new Error("source_unavailable"); row = result.data;
    names = result.data?.display_name ? [result.data.display_name] : [];
  } else if (ref.kind === "person") {
    const result = await db.from("unclaimed_profiles").select("name,bio").eq("id", ref.id).is("claimed_by", null).abortSignal(signal).maybeSingle();
    if (result.error) throw new Error("source_unavailable"); row = result.data;
    names = result.data?.name ? [result.data.name] : [];
  } else if (ref.kind === "project") {
    // Public projects and project_drafts are separate tables; never read drafts here.
    const result = await db.from("projects").select("description,metadata,title,director,created_by").eq("id", ref.id).abortSignal(signal).maybeSingle();
    if (result.error) throw new Error("source_unavailable");
    if (result.data) {
      row = projectRecordWithDetails(result.data) as unknown as Record<string, unknown>;
      names = [row.title, row.director, row.production_company].filter((name): name is string => typeof name === "string");
      owner = result.data.created_by;
    }
  } else if (ref.kind === "community" || ref.kind === "reply") {
    const postId = ref.kind === "community" ? ref.id : null;
    if (!postId) {
      const reply = await db.from("community_replies").select("body,author_id,post_id").eq("id", ref.id).abortSignal(signal).maybeSingle();
      if (reply.error) throw new Error("source_unavailable");
      if (!reply.data || !(await eligibleAuthor(reply.data.author_id, viewerId, signal))) return null;
      row = reply.data;
    }
    const post = await db.from("community_posts").select("title,body,author_id").eq("id", postId ?? row!.post_id)
      .gt("expires_at", new Date().toISOString()).abortSignal(signal).maybeSingle();
    if (post.error) throw new Error("source_unavailable");
    if (!post.data || !(await eligibleAuthor(post.data.author_id, viewerId, signal))) return null;
    if (postId) row = post.data;
  } else if (ref.kind === "service") {
    const result = await db.from("company_services").select("title,description,price_note,company:companies!inner(name,published,owner_user_id)")
      .eq("id", ref.id).eq("company.published", true).abortSignal(signal).maybeSingle();
    if (result.error) throw new Error("source_unavailable"); row = result.data;
    const company = result.data?.company as unknown as {name: string; owner_user_id: string} | undefined;
    if (company) { names = [company.name]; owner = company.owner_user_id; }
  }
  if (!row || (owner && await blocked(owner, viewerId, signal))) return null;
  return {fields: publicTranslationFields(ref.kind, row), names};
}
async function blocked(owner: string, viewer: string | null, signal: AbortSignal) {
  if (!viewer || owner === viewer) return false;
  const [incoming, outgoing] = await Promise.all([
    db.from("blocks").select("blocker_id").eq("blocker_id", owner).eq("blocked_id", viewer).limit(1).abortSignal(signal),
    db.from("blocks").select("blocker_id").eq("blocker_id", viewer).eq("blocked_id", owner).limit(1).abortSignal(signal),
  ]);
  if (incoming.error || outgoing.error) throw new Error("source_unavailable");
  return !!(incoming.data?.length || outgoing.data?.length);
}
async function eligibleAuthor(owner: string, viewer: string | null, signal: AbortSignal) {
  const settings = await db.from("user_settings").select("ghost_mode").eq("user_id", owner).abortSignal(signal).maybeSingle();
  if (settings.error) throw new Error("source_unavailable");
  return !settings.data?.ghost_mode && !(await blocked(owner, viewer, signal));
}
