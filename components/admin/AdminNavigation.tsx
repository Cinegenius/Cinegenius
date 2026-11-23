"use client";

import { useRef, type ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, CircleAlert, type LucideProps } from 'lucide-react';

export const ADMIN_NAV_GROUPS = [
  { id: 'start', tabs: ['overview'] },
  { id: 'people', tabs: ['accounts', 'users', 'companies'] },
  { id: 'review', tabs: ['reviews', 'verifications', 'reports', 'started-offers', 'support'] },
  { id: 'content', tabs: ['listings', 'projects', 'organizations', 'bookings', 'media', 'newsletter'] },
  { id: 'system', tabs: ['audit'] },
] as const;

export type AdminNavItem = { id: string; label: string; icon: ComponentType<LucideProps>; badge?: number; badgeLabel?: string; errorLabel?: string };
export type AdminNavLink = { href: string; label: string; group: 'review' | 'content' | 'system' };

/** Both layouts use the same destinations; mobile is grouped instead of an endless tab strip. */
export function AdminNavigation({ items, links, activeTab, onSelect, mobile = false }: { items: AdminNavItem[]; links: AdminNavLink[]; activeTab: string; onSelect: (id: string) => void; mobile?: boolean }) {
  const t = useTranslations('AdminClarity');
  const details = useRef<HTMLDetailsElement>(null);
  const content = <nav aria-label={t('navigation')} className="space-y-5 p-3">
    {ADMIN_NAV_GROUPS.map(group => <section key={group.id} aria-label={t('groups.' + group.id)}>
      {group.id !== 'start' && <h2 className="mb-1 px-3 text-xs font-semibold text-text-muted">{t('groups.' + group.id)}</h2>}
      <div className="space-y-1">{group.tabs.map(id => {
        const item = items.find(candidate => candidate.id === id);
        if (!item) return null;
        const Icon = item.icon;
        return <button key={id} type="button" aria-current={activeTab === id ? 'page' : undefined} onClick={() => { onSelect(id); if (details.current) details.current.open = false; }} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${activeTab === id ? 'bg-gold/10 text-gold' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'}`}>
          <Icon size={16} className="shrink-0" /><span className="min-w-0 flex-1 break-words text-left">{item.label}</span>
          {!!item.badge && <span aria-label={item.badgeLabel} className="min-w-5 shrink-0 rounded-full bg-gold px-1.5 py-0.5 text-center text-[10px] font-bold text-bg-primary">{item.badge}</span>}
          {item.errorLabel && <CircleAlert size={15} className="shrink-0" aria-label={item.errorLabel} />}
        </button>;
      })}{links.filter(link => link.group === group.id).map(link => <a key={link.href} href={link.href} className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary">{link.label}</a>)}</div>
    </section>)}
  </nav>;
  if (!mobile) return <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>;
  return <details ref={details} className="border-b border-border bg-bg-primary lg:hidden">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm text-text-secondary [&::-webkit-details-marker]:hidden"><span>{t('navigation')} · {items.find(item => item.id === activeTab)?.label}</span><ChevronDown size={16} className="shrink-0" /></summary>
    {content}
  </details>;
}
