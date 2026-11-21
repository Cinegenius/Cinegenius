import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminSupportParticipants } from '@/lib/admin-support-participants';
import { feedbackEnvelope, FEEDBACK_UUID } from '@/lib/community-feedback';
const headers = {'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store'};
const json = (body:unknown,status=200)=>NextResponse.json(body,{status,headers});
export const dynamic = 'force-dynamic';
export async function GET(request:NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) { for(const [key,value] of Object.entries(headers)) admin.headers.set(key,value); return admin; }
  if (request.headers.get('X-Feedback-Account') !== admin.userId) return json({error:'account_changed'},409);
  const cursor = request.nextUrl.searchParams.get('before');
  let before: {date:string;id:string} | null = null;
  if (cursor) {
    try {
      const [date,id] = JSON.parse(cursor);
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?$/.test(date) || Number.isNaN(Date.parse(date)) || !FEEDBACK_UUID.test(id)) throw Error();
      before={date,id};
    } catch { return json({error:'invalid_request'},400); }
  }
  try {
    // Only completed packets in private member/support conversations, never general chat data.
    let query = db.from('messages').select('id,conversation_id,sender_id,created_at,content,conversations!inner(kind,receiver_id)')
      .eq('conversations.kind','support').like('content','CG_FEEDBACK_V1 END %')
      .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(21);
    if (before) query=query.or(`created_at.lt.${before.date},and(created_at.eq.${before.date},id.lt.${before.id})`);
    const result=await query.abortSignal(AbortSignal.any([request.signal,AbortSignal.timeout(10_000)]));
    if(result.error) return json({error:'unavailable'},503);
    const page=(result.data ?? []).slice(0,20);
    const rows=page.flatMap(row=>{
      const conversation=Array.isArray(row.conversations)?row.conversations[0]:row.conversations;
      const meta=feedbackEnvelope(row.content);
      return conversation?.receiver_id===row.sender_id && meta ? [{...meta,id:row.id,conversationId:row.conversation_id,userId:row.sender_id,createdAt:row.created_at}] : [];
    });
    const ids=[...new Set(rows.map(row=>row.userId))];
    const profiles=ids.length ? await db.from('profiles').select('user_id,display_name,slug,avatar_url').in('user_id',ids) : {data:[],error:null};
    if(profiles.error) return json({error:'unavailable'},503);
    const users=await adminSupportParticipants(ids,profiles.data ?? []);
    const last=page.at(-1);
    return json({items:rows.map(row=>({...row,name:users.get(row.userId)?.display_name || row.userId})),next:(result.data?.length ?? 0)>20 && last ? JSON.stringify([last.created_at,last.id]) : null});
  } catch { return json({error:'unavailable'},503); }
}
