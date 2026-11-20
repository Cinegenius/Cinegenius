import { isAppLocale } from "@/lib/i18n/locales";
import { getTranslations } from 'next-intl/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { trustedMutationOrigin } from '@/lib/request-origin';
import { GenieError, readBoundedJson, genieConfiguration, reserveGenieUsage } from '@/lib/genie-server';
import { readFeedbackInput, readFeedbackSubmission, FEEDBACK_UUID } from '@/lib/community-feedback';
import { generateFeedback, feedbackDelivery } from '@/lib/community-feedback-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 35;
const headers = {'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body: unknown, status=200) => NextResponse.json(body,{status,headers});

export async function GET(request: NextRequest) {
  const user=await getCurrentUser();
  if (!user) return json({error:'unauthorized'},401);
  const locale=request.nextUrl.searchParams.get('lang');
  if (!isAppLocale(locale)) return json({error:'invalid_request'},400);
  const t=await getTranslations({locale,namespace:'Feedback'});
  return json({opening:t('opening'),locale});
}

export async function POST(request: NextRequest) {
  if (!trustedMutationOrigin({requestUrl:request.url,origin:request.headers.get('origin'),referer:request.headers.get('referer'),
    development:process.env.NODE_ENV !== 'production',deploymentHost:process.env.VERCEL_URL})) return json({error:'invalid_request'},403);
  try {
    const user = await getCurrentUser();
    if (!user) return json({error:'unauthorized'},401);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return json({error:'invalid_request'},400);
    const body = await readBoundedJson(request,96 * 1024,new GenieError('invalid_request',413)) as Record<string, unknown> | null;
    if (!body || body.accountId !== user.userId) return json({error:'account_changed'},409);
    if (body.action === 'discuss') {
      const input = readFeedbackInput(body.input);
      if (!input) return json({error:'invalid_request'},400);
      const config = genieConfiguration(user.userId);
      await reserveGenieUsage(request,user.userId,config);
      return json({advice:await generateFeedback(request,input,config)});
    }
    if (body.action !== 'submit') return json({error:'invalid_request'},400);
    const submission = readFeedbackSubmission(body.input);
    if (!submission) return json({error:'invalid_request'},400);
    // Submission makes no paid call and needs no functioning AI provider.
    if (!(await rateLimit(`feedback-submit:${user.userId}`,10,60)).allowed) return json({error:'rate_limited'},429);
    const signal = AbortSignal.any([request.signal,AbortSignal.timeout(20_000)]);
    let conversationId = '';
    const t = await getTranslations({locale:'de',namespace:'Feedback'});
    const conversationCopy = await getTranslations({locale:submission.locale,namespace:'Feedback'});
    const labels = {title:t('title'),unreviewed:t('reportNotice'),original:t('evidence'),conversation:t('conversation'),member:t('reportMember'),country:t('country'),language:t('language'),high:t('priority.high'),normal:t('priority.normal'),idea:t('priority.idea'),opening:conversationCopy('opening')};
    for (const part of feedbackDelivery(submission,labels)) {
      const result = await db.rpc('contact_support',{
        p_user_id:user.userId,p_content:part.content,p_idempotency_key:part.key,p_label:`CineGenius · ${t('title')}`,
      }).abortSignal(signal);
      if (result.error) return json({error:result.error.code === 'PT409' ? 'busy' : 'unavailable'},result.error.code === 'PT409' ? 409 : 503);
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!FEEDBACK_UUID.test(row?.conversation_id ?? '') || !FEEDBACK_UUID.test(row?.message_id ?? '')
        || (conversationId && conversationId !== row.conversation_id)) return json({error:'unavailable'},503);
      conversationId = row.conversation_id;
    }
    return json({conversationId});
  } catch (error) {
    return error instanceof GenieError ? json({error:error.code},error.status) : json({error:'unavailable'},503);
  }
}
