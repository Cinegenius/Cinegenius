import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { organizationEntryBrowse } from '@/lib/organization-entry-browser-server';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const session = await requireAdmin();
  if (session instanceof NextResponse) { session.headers.set('Cache-Control', 'private, no-store'); return session; }
  try {
    const result = await organizationEntryBrowse({ admin: true }, new URL(request.url).searchParams);
    return NextResponse.json(result ?? { error: 'not_found' }, { status: result ? 200 : 404, headers });
  } catch { return NextResponse.json({ error: 'load' }, { status: 503, headers }); }
}
