import { NextResponse, type NextRequest } from 'next/server';
import { MESSAGING_HEADERS } from '@/lib/messaging-backend';

export const FRIENDSHIPS_V1 = 'cinegenius.friendships.v1';
export const MESSAGE_OPEN_V1 = 'cinegenius.message-open.v1';
export const MESSAGING_V1 = 'cinegenius.messaging.v1';
export const nativeJson = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: MESSAGING_HEADERS});

/** Opt-in only. Validate the actor before any private lookup, including capability probes. */
export function nativeReadGuard(request: NextRequest, actor: string, contract: string, translate: (key: string) => string) {
  const requested = request.headers.get('X-CineGenius-Native-Contract');
  if (requested === null) return null;
  if (requested !== contract) return nativeJson({error: translate('invalid'), code: 'unsupported_contract'}, 400);
  if (request.headers.get('X-Contact-Account') !== actor) return nativeJson({error: translate('changed'), code: 'account_changed'}, 409);
  return null;
}

export function privateNativeResponse(response: NextResponse) {
  for (const [key, value] of Object.entries(MESSAGING_HEADERS)) response.headers.set(key, value);
  return response;
}
