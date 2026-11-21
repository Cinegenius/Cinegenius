import "server-only";
import { db } from "@/lib/db";
import { newsDiscoveryIndex, regionalNews } from '@/lib/news-discovery';
import { newsEntryCountry } from '@/lib/news-region';
import { UNASSIGNED_COUNTRY } from '@/lib/places/core';
import { isOrganizationTopic, type OrganizationTopic } from '@/lib/organization-taxonomy';
import { browseCountryChoice } from '@/lib/browse-country';

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
export async function organizationDiscovery(page=1,limit=24,country:unknown='',signal?:AbortSignal) {
 const selectedCountry=browseCountryChoice(country);
 if(selectedCountry===undefined)throw new Error('organization_country_invalid');
 page=Number.isFinite(page)?Math.min(10000,Math.max(1,Math.floor(page))):1;
 limit=Number.isFinite(limit)?Math.min(24,Math.max(1,Math.floor(limit))):24;
 let query=db.from('organizations').select(projection).eq('moderation_status','approved');
 if(selectedCountry===UNASSIGNED_COUNTRY)query=query.or('place_country_code.is.null,place_country_code.eq.""');
 else if(selectedCountry)query=query.eq('place_country_code',selectedCountry);
 if(signal)query=query.abortSignal(signal);
 const result=await query.order('created_at',{ascending:false}).order('id').range((page-1)*limit,page*limit);
 if(result.error) throw new Error('organization_discovery_unavailable');
 return {organizations:(result.data??[]).slice(0,limit) as PublicOrganization[],hasMore:(result.data?.length??0)>limit,page};
}
export async function latestOrganizationEntries(country = '', topic: OrganizationTopic | '' = '', requestedLimit = 3) {
 const limit = Number.isFinite(requestedLimit) ? Math.min(12, Math.max(1, Math.floor(requestedLimit))) : 3;
 const selectedTopic = isOrganizationTopic(topic) ? topic : '';
 const ids = country ? regionalNews(await newsDiscoveryIndex(), country, true)
  .filter(row => !selectedTopic || row.topic === selectedTopic).slice(0, limit).map(row => row.id) : null;
 if (ids && !ids.length) return [];
 let query=db.from('organization_entries')
 .select('id,slug,title,summary,entry_type,topic,image_url,starts_at,ends_at,created_at,place_country_code,city,organization:organizations!inner(slug,name,logo_url,moderation_status,place_country_code,region)')
 .eq('moderation_status','approved').eq('organization.moderation_status','approved')
 .or(`entry_type.eq.news,ends_at.gte.${new Date().toISOString()},and(ends_at.is.null,starts_at.gte.${new Date().toISOString()})`)
 .order('created_at',{ascending:false}).order('id').limit(limit);
 if (ids) query = query.in('id', ids);
 if (selectedTopic) query = query.eq('topic', selectedTopic);
 const result = await query;
 if(result.error) throw new Error('organization_entries_unavailable');
 return (result.data??[]).filter(row => (!selectedTopic || row.topic === selectedTopic) && (!country || (newsEntryCountry(row) || UNASSIGNED_COUNTRY) === country)).slice(0, limit);
}
