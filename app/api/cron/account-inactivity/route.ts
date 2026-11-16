import { NextRequest, NextResponse } from 'next/server';
import { authorizedListingFreshnessCron } from '@/lib/listing-freshness-cron-auth';
import { ACCOUNT_ACTIVITY_HEADERS as headers, runAccountActivityWorker } from '@/lib/account-activity-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  if (!authorizedListingFreshnessCron(request.headers.get('authorization'), process.env.CRON_SECRET)) return NextResponse.json({ code: 'unauthorized' }, { status: 401, headers });
  try { return NextResponse.json(await runAccountActivityWorker(), { headers }); }
  catch { return NextResponse.json({ code: 'unavailable' }, { status: 503, headers }); }
}
export function HEAD() { return new NextResponse(null, { status: 405, headers: { ...headers, Allow: 'GET' } }); }
