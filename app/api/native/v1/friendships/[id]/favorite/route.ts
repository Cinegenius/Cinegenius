import { NextRequest, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { contactId } from '@/lib/contact-connections';
import { FRIENDSHIPS_V1, nativeJson, privateNativeResponse } from '@/lib/native-contact-contract';

export async function PUT(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const member = await requireAuth();
  if (member instanceof NextResponse) return privateNativeResponse(member);
  const t = await getTranslations('Contacts');
  const fail = (key: string, code: string, status: number) => nativeJson({error: t(key), code}, status);
  const body = await request.json().catch(() => null);
  if (body?.contract !== FRIENDSHIPS_V1) return fail('invalid', 'unsupported_contract', 400);
  if (body.accountId !== member.userId) return fail('changed', 'account_changed', 409);
  const {id} = await params;
  if (!contactId.test(id) || typeof body.is_favorite !== 'boolean') return fail('invalid', 'invalid', 400);
  const friendshipId = id.toLowerCase();
  if (!(await rateLimit(`contact-change:${member.userId}`, 40, 60)).allowed) return fail('rateLimited', 'rate_limited', 429);
  const {data, error} = await db.rpc('set_contact_favorite_v1', {p_actor: member.userId, p_id: friendshipId, p_favorite: body.is_favorite});
  if (error?.code === 'PT409' || error?.code === '55P03') return fail('busy', 'busy', 409);
  if (error || !data) return fail('error', 'unavailable', 503);
  if (data.status === 'missing') return fail('unavailable', 'contact_unavailable', 404);
  if (data.status === 'blocked') return fail('unavailable', 'contact_unavailable', 403);
  if (data.status === 'busy') return fail('busy', 'busy', 409);
  if (data.status === 'invalid') return fail('invalid', 'invalid', 400);
  if (data.status !== 'saved' || data.friendship_id !== friendshipId || data.is_favorite !== body.is_favorite || typeof data.changed !== 'boolean') return fail('error', 'unavailable', 503);
  return nativeJson({contract: FRIENDSHIPS_V1, success: true, accountId: member.userId, friendship_id: friendshipId, is_favorite: data.is_favorite, changed: data.changed});
}
