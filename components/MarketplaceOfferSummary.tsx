'use client';
import { useLocale, useTranslations } from 'next-intl';
import { MARKETPLACE_COMMON_FIELDS, marketplaceSpecFields, marketplaceCategoryLabel } from '@/lib/marketplace-offer';
import { listingPriceLabel, listingPriceMetadata } from '@/lib/listing-price';

export default function MarketplaceOfferSummary({category,price,metadata}:{category:string;price:number;metadata:unknown}) {
 const t=useTranslations('MarketplaceOffer');const catalog=useTranslations('MarketplaceCatalog');const locale=useLocale();
 const offer=listingPriceMetadata(metadata).marketplace;if(!offer)return null;
 const fields=MARKETPLACE_COMMON_FIELDS.flatMap(key=>typeof offer[key]==='string'&&offer[key]?[[key,offer[key]!]as const]:[]);
 const specs=marketplaceSpecFields(category).flatMap(key=>typeof offer.specs?.[key]==='string'&&offer.specs[key]?[[key,offer.specs[key]]as const]:[]);
 return <section className="my-5 min-w-0 rounded-xl border border-border bg-bg-secondary p-4" data-marketplace-summary><h2 className="mb-3 text-base font-semibold text-text-primary">{marketplaceCategoryLabel(category,catalog)}</h2><p className="mb-4 break-words font-semibold text-gold">{listingPriceLabel(price,metadata,'/Tag',locale,t)}</p><dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2"><div><dt className="text-text-muted">{t('bundle')}</dt><dd>{t(offer.bundle)}</dd></div>{fields.map(([key,value])=><div className="min-w-0" key={key}><dt className="text-text-muted">{t(`fields.${key}`)}</dt><dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value}</dd></div>)}{offer.fulfilment?.length>0&&<div><dt className="text-text-muted">{t('fulfilment')}</dt><dd>{offer.fulfilment.map(method=>t(method)).join(' · ')}</dd></div>}{specs.map(([key,value])=><div className="min-w-0" key={key}><dt className="text-text-muted">{t(`fields.${key}`)}</dt><dd className="break-words [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>{specs.length>0&&<p className="mt-4 text-xs text-text-muted">{t('supplierValues')}</p>}</section>;
}
