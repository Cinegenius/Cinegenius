import { clerkClient } from '@clerk/nextjs/server';
import { getTranslations } from 'next-intl/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/requireAdmin';
import { accountDirectoryRow } from '@/lib/admin-account-directory';

const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' };

/** Small account index only. Private offers/drafts are read separately on opening a row. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const t = await getTranslations('AdminAccounts');
  const page = Number(request.nextUrl.searchParams.get('page') ?? '1');
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) return NextResponse.json({ error: t('loadError') }, { status: 400, headers });
  try {
    const clerk = await clerkClient();
    const { data: users, totalCount } = await clerk.users.getUserList({ limit: 100, offset: (page - 1) * 100, orderBy: '-created_at' });
    const ids = users.map(user => user.id);
    if (!ids.length) return NextResponse.json({ accounts: [], total: totalCount, page, pageSize: 100 }, { headers });
    const [{ data: profiles, error }, { data: settings, error: settingsError }, owners] = await Promise.all([
      db.from('profiles').select('user_id,display_name,slug,avatar_url,location,positions,role,profile_type,profile_types,verified').in('user_id', ids).abortSignal(request.signal),
      db.from('user_settings').select('user_id,profile_visibility').in('user_id', ids).abortSignal(request.signal),
      companyOwners(ids, request.signal),
    ]);
    if (error || settingsError) throw new Error('directory_read_failed');
    const byId = new Map((profiles ?? []).map(profile => [profile.user_id, profile]));
    const visibility = new Map((settings ?? []).map(setting => [setting.user_id, setting.profile_visibility]));
    return NextResponse.json({ accounts: users.map(user => accountDirectoryRow(user, byId.get(user.id) ?? null, visibility.get(user.id) ?? null, owners.has(user.id))), total: totalCount, page, pageSize: 100 }, { headers });
  } catch {
    return NextResponse.json({ error: t('loadError') }, { status: 503, headers });
  }
}

async function companyOwners(ids: string[], signal: AbortSignal) {
  const owners = new Set<string>();
  for (let page = 0; page < 10; page++) {
    const { data, error } = await db.from('companies').select('id,owner_user_id').in('owner_user_id', ids)
      .order('id', { ascending: true }).range(page * 1000, (page + 1) * 1000 - 1).abortSignal(signal);
    if (error) throw new Error('directory_company_read_failed');
    for (const company of data ?? []) owners.add(company.owner_user_id);
    if ((data ?? []).length < 1000) return owners;
  }
  throw new Error('directory_company_limit');
}
