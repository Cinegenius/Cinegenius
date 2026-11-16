import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { trustedMutationOrigin } from '@/lib/request-origin';
import { ACCOUNT_ACTIVITY_HEADERS as headers, getAccountActivity, recordAccountActivity } from '@/lib/account-activity-server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: 'unauthorized' }, { status: 401, headers });
  try { return NextResponse.json(await getAccountActivity(user.userId), { headers }); }
  catch { return NextResponse.json({ code: 'unavailable' }, { status: 503, headers }); }
}
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: 'unauthorized' }, { status: 401, headers });
  if (!trustedMutationOrigin({ requestUrl: request.url, origin: request.headers.get('origin'), referer: request.headers.get('referer'), development: process.env.NODE_ENV !== 'production', deploymentHost: process.env.VERCEL_URL })) {
    return NextResponse.json({ code: 'forbidden' }, { status: 403, headers });
  }
  // No client timestamps, account IDs or links accepted. Reading is never activity.
  try {
    const result = await recordAccountActivity(user.userId);
    return NextResponse.json({ ...await getAccountActivity(user.userId), ...result }, { headers });
  } catch { return NextResponse.json({ code: 'unavailable' }, { status: 503, headers }); }
}
