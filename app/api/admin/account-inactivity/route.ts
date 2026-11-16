import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { accountActivityEnabled } from '@/lib/account-activity';
import { ACCOUNT_ACTIVITY_HEADERS as headers } from '@/lib/account-activity-server';
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) { for (const [key, value] of Object.entries(headers)) admin.headers.set(key, value); return admin; }
  if (!accountActivityEnabled()) return NextResponse.json({ enabled: false, accounts: [], total: 0 }, { headers });
  const raw = Number(request.nextUrl.searchParams.get('page') ?? 1);
  const page = Number.isSafeInteger(raw) && raw > 0 ? Math.min(raw, 100000) : 1;
  const { data, error, count } = await db.from('account_activity').select('user_id,stage,last_activity_at,review_after,issue', { count: 'exact' })
    .eq('exempt', false).or('stage.neq.active,issue.not.is.null').order('updated_at').order('user_id').range((page - 1) * 25, page * 25 - 1);
  if (error) return NextResponse.json({ code: 'unavailable' }, { status: 503, headers });
  return NextResponse.json({ enabled: true, accounts: data, total: count, page, pageSize: 25 }, { headers });
}
