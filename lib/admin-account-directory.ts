import { adminAccountRow, type AdminAccountProfile, type AdminAccountUser } from './admin-account-status';
import { filterProviderProfiles, CREW_PROVIDER_FILTER, LOCATION_PROVIDER_FILTER, MARKETPLACE_PROVIDER_FILTER } from './profile-provider-filters';

export const ACCOUNT_AREAS = ['crew', 'marketplace', 'locations', 'companies', 'search', 'unassigned'] as const;
export type AccountArea = typeof ACCOUNT_AREAS[number];
export type AccountSetupFilter = 'all' | 'open' | 'complete';
export type AccountSort = 'newest' | 'oldest' | 'name' | 'active';

/** Areas may overlap. A setup goal is not proof of a finished or public profile. */
export function accountDirectoryRow(user: AdminAccountUser, profile: (AdminAccountProfile & { verified?: boolean }) | null, visibility: string | null, ownsCompany: boolean) {
  const account = adminAccountRow(user, profile, visibility);
  const areas = new Set<AccountArea>();
  if (account.purposes.some(p => p === 'crew' || p === 'talent') || (profile && filterProviderProfiles([profile], CREW_PROVIDER_FILTER).length)) areas.add('crew');
  if (account.purposes.includes('equipment') || (profile && filterProviderProfiles([profile], MARKETPLACE_PROVIDER_FILTER).length)) areas.add('marketplace');
  if (account.purposes.includes('location') || (profile && filterProviderProfiles([profile], LOCATION_PROVIDER_FILTER).length)) areas.add('locations');
  if (ownsCompany || account.purposes.includes('company')) areas.add('companies');
  if (account.purposes.includes('search')) areas.add('search');
  if (!areas.size) areas.add('unassigned');
  return { ...account, areas: ACCOUNT_AREAS.filter(area => areas.has(area)), profileVerified: profile?.verified === true };
}
export type DirectoryAccount = ReturnType<typeof accountDirectoryRow>;

export function selectDirectoryAccounts(accounts: readonly DirectoryAccount[], filters: { search: string; area: string; setup: string; sort: string; locale: string }) {
  const search = filters.search.trim().normalize('NFKC').toLocaleLowerCase(filters.locale);
  const matches = accounts.filter(account =>
    (filters.area === 'all' || account.areas.includes(filters.area as AccountArea))
    && (filters.setup === 'all' || account.needsSetup === (filters.setup === 'open'))
    && (!search || [account.name, account.email, account.userId].some(value => value?.normalize('NFKC').toLocaleLowerCase(filters.locale).includes(search)))
  );
  const collator = new Intl.Collator(filters.locale, { sensitivity: 'base', numeric: true });
  return matches.sort((a, b) => {
    const order = filters.sort === 'oldest' ? a.createdAt - b.createdAt
      : filters.sort === 'name' ? (a.name ? b.name ? collator.compare(a.name, b.name) : -1 : b.name ? 1 : 0)
      : filters.sort === 'active' ? (b.lastSignInAt ?? 0) - (a.lastSignInAt ?? 0) : b.createdAt - a.createdAt;
    return order || a.userId.localeCompare(b.userId);
  });
}

/** Consume the complete paged index before showing global filters or totals.
 * Reject duplicates/changing totals instead of silently calling a partial page complete. */
export async function readAccountDirectory(loadPage: (page: number) => Promise<{ accounts: DirectoryAccount[]; total: number; page: number; pageSize: number }>) {
  const accounts: DirectoryAccount[] = [];
  const ids = new Set<string>();
  let total: number | undefined;
  for (let page = 1; page <= 100; page++) {
    const batch = await loadPage(page);
    if (batch.page !== page || batch.pageSize !== 100 || !Number.isSafeInteger(batch.total) || batch.total < 0 || batch.total > 10000 || !Array.isArray(batch.accounts) || (total !== undefined && total !== batch.total)) throw new Error('directory_changed');
    total = batch.total;
    if (batch.accounts.length !== Math.min(100, Math.max(0, total - accounts.length))) throw new Error('directory_incomplete');
    for (const account of batch.accounts) {
      if (!account.userId || ids.has(account.userId)) throw new Error('directory_duplicate');
      ids.add(account.userId);
      accounts.push(account);
    }
    if (accounts.length === total) return accounts;
  }
  throw new Error('directory_too_large');
}
