import "server-only";
import { db } from "@/lib/db";

export type PublicOrganization = {id:string;slug:string;name:string;logo_url:string|null;city:string|null};
const projection = "id,slug,name,logo_url,city";
// No cross-request cache: withdrawal of approval or a link takes effect immediately.
export async function publicOrganizationLinks(target: {userId:string}|{companyId:string}): Promise<PublicOrganization[]> {
 const person = 'userId' in target;
 let query = db.from(person ? 'organization_members' : 'organization_company_links')
  .select(`organization:organizations!inner(${projection},moderation_status)`)
  .eq('organization.moderation_status','approved').eq('status',person?'active':'accepted');
 if ('userId' in target) query=query.eq('user_id',target.userId).eq('public_profile',true);
 else query=query.eq('company_id',target.companyId);
 const result=await query.order('created_at',{ascending:false}).limit(50);
 if(result.error) throw new Error('organization_links_unavailable');
 return (result.data??[]).map(row=>(Array.isArray(row.organization)?row.organization[0]:row.organization) as unknown as PublicOrganization);
}
export async function organizationDiscovery(page=1,limit=24) {
 page=Number.isFinite(page)?Math.min(10000,Math.max(1,Math.floor(page))):1;
 limit=Math.min(24,Math.max(1,Math.floor(limit)));
 const result=await db.from('organizations').select(projection).eq('moderation_status','approved')
 .order('created_at',{ascending:false}).order('id').range((page-1)*limit,page*limit);
 if(result.error) throw new Error('organization_discovery_unavailable');
 return {organizations:(result.data??[]).slice(0,limit) as PublicOrganization[],hasMore:(result.data?.length??0)>limit,page};
}
export async function latestOrganizationEntries() {
 const result=await db.from('organization_entries')
 .select('id,slug,title,summary,entry_type,image_url,starts_at,ends_at,created_at,organization:organizations!inner(slug,name,moderation_status)')
 .eq('moderation_status','approved').eq('organization.moderation_status','approved')
 .or(`entry_type.eq.news,ends_at.gte.${new Date().toISOString()},and(ends_at.is.null,starts_at.gte.${new Date().toISOString()})`)
 .order('created_at',{ascending:false}).order('id').limit(3);
 if(result.error) throw new Error('organization_entries_unavailable');
 return result.data??[];
}
