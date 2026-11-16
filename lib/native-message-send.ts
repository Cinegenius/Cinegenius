import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth';
import { messagingRequestKey, messagingUuid } from '@/lib/messaging-backend';
import { MESSAGING_V1, nativeJson, privateNativeResponse } from '@/lib/native-contact-contract';

/** Versioned text-only adapter; the existing handler owns rights, rate limits, RPCs and mail. */
export async function nativeMessageSend(request: NextRequest, send: (request: NextRequest) => Promise<NextResponse>) {
  const member = await requireAuth();
  if (member instanceof NextResponse) return privateNativeResponse(member);
  const t = await getTranslations('MessagingBackend');
  const body = await request.clone().json().catch(() => null);
  if (body?.contract !== MESSAGING_V1) return nativeJson({error: t('invalid'), code: 'unsupported_contract'}, 400);
  if (body.accountId !== member.userId) return nativeJson({error: t('accountChanged'), code: 'account_changed'}, 403);
  if (typeof body.content !== 'string' || !body.content.trim() || body.content.trim().length > 5000
    || !messagingRequestKey(body.idempotencyKey) || body.attachmentIds !== undefined) {
    return nativeJson({error: t('invalid'), code: 'invalid'}, 400);
  }
  const result = await send(request);
  if (!result.ok) return privateNativeResponse(result);
  const saved = await result.json().catch(() => null);
  if (!messagingUuid(saved?.conversationId) || !messagingUuid(saved?.message?.id) || typeof saved?.replayed !== 'boolean') {
    return nativeJson({error: t('saveError'), code: 'unavailable'}, 503);
  }
  return nativeJson({...saved, contract: MESSAGING_V1, accountId: member.userId});
}
