/** Search all loaded members before bounding the rendered rows in each status group. */
export const TEAM_MEMBER_PAGE_SIZE = 30;
type DirectoryMember = {userId:string;name:string;status:'active'|'invited'};
export function teamMemberDirectory<T extends DirectoryMember>(members:readonly T[],query:string,locale:string,limit=TEAM_MEMBER_PAGE_SIZE) {
 const fold=(value:string)=>value.toLocaleLowerCase(locale).normalize('NFKD').replace(/\p{M}/gu,'');
 const needle=fold(query.trim()),collator=new Intl.Collator(locale,{sensitivity:'base',numeric:true});
 const matches=members.filter(member=>fold(member.name).includes(needle)).sort((a,b)=>collator.compare(a.name,b.name)||a.userId.localeCompare(b.userId));
 const pageSize=Number.isFinite(limit)?Math.max(TEAM_MEMBER_PAGE_SIZE,Math.floor(limit)):TEAM_MEMBER_PAGE_SIZE;
 const group=(status:T['status'])=>{const all=matches.filter(member=>member.status===status);return {total:all.length,visible:all.slice(0,pageSize)};};
 const active=group('active'),invited=group('invited');
 return {active,invited,hasMore:active.total>active.visible.length||invited.total>invited.visible.length};
}
