"use client";
import {useLocale,useTranslations} from 'next-intl';
import {usePathname} from 'next/navigation';

export default function LegalLanguageNotice() {
  const locale=useLocale(),t=useTranslations('legalLanguage'),path=usePathname();
  if(locale==='de'||!['/agb','/datenschutz','/impressum'].includes(path))return null;
  return <aside role="note" className="site-container pt-20 sm:pt-24"><p className="rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm leading-6 text-text-secondary">{t('original')}</p></aside>;
}
