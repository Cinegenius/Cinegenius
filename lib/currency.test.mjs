import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {CURRENCY_CODES,isCurrencyCode,listingCurrency,formatOfferAmount,currencyOptions} from './currency.ts';
import {listingPriceLabel,listingStructuredOffers,listingPriceMetadataError} from './listing-price.ts';
import {marketplaceDraft,marketplaceMetadataPatch} from './marketplace-offer.ts';
import {publicLocationBrowseMetadata} from './location-privacy.ts';
import {readLocationLandingFilters,filterLandingLocations} from './locations-landing-filters.ts';
import {normalizeQuickStartDraft,createQuickStartIntentData} from './quick-start-flow.ts';
const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'];
test('all17 languages keep actual currencies and three-decimal amounts; codes disambiguate pesos and dollars',()=>{
 for(const locale of locales){
  const options=currencyOptions(locale);assert.equal(options.length,CURRENCY_CODES.length);
  for(const code of ['MXN','CHF','HUF','EUR','USD','KWD','XCG','ZWG']){
   const result=listingPriceLabel(1234.567,{price_currency:code},'',locale);
   assert.ok(result.includes(code==='EUR'?'€':code));
   assert.ok(result.includes(new Intl.NumberFormat(locale,{maximumFractionDigits:6}).format(1234.567)));
   assert.equal(listingStructuredOffers(1234.567,{price_currency:code})[0].priceCurrency,code);
  }
 }
 assert.equal(isCurrencyCode('MXN'),true);assert.equal(isCurrencyCode('mxn'),false);
 assert.equal(isCurrencyCode('XXX'),false);assert.equal(isCurrencyCode('BGN'),false);
 assert.ok(formatOfferAmount(10,'BGN','es').endsWith('BGN'),'historical amount must not become euros');
});
test('legacy EUR remains stable; marketplace editing and public location projection preserve the selected unit',()=>{
 assert.equal(listingCurrency(null),'EUR');
 for(const code of ['EUR','MXN','CHF','HUF','BGN']){
  const metadata={price_currency:code,price_on_request:false,price_negotiable:true,private_address:'never project'};
  const draft=marketplaceDraft('kamera-kameras',1234.5,metadata);
  assert.equal(draft.values.currency,code);
  assert.equal(marketplaceMetadataPatch(draft).price_currency,code);
  const publicMeta=publicLocationBrowseMetadata(metadata);
  assert.equal(publicMeta.price_currency,code);assert.equal(publicMeta.private_address,undefined);
  assert.equal(listingPriceMetadataError(metadata),null);
 }
 assert.ok(listingPriceMetadataError({price_currency:'x'}));
});
test('price bounds and sorting never compare pesos with euros and retain canonical currency in shared links',()=>{
 const base={title:'Studio',city:'',type:'Studio',priceOnRequest:false,rating:0};
 const rows=[{...base,id:'eur-old',price:300},{...base,id:'mxn',price:100,metadata:{price_currency:'MXN'}},{...base,id:'eur',price:200,metadata:{price_currency:'EUR'}}];
 const filter=values=>filterLandingLocations(rows,readLocationLandingFilters(values),v=>v).map(r=>r.id);
 assert.deepEqual(filter({}),['eur-old','mxn','eur']);
 assert.deepEqual(filter({sort:'price-asc'}),['eur','eur-old']);
 assert.deepEqual(filter({min:'1',max:'500',currency:'MXN'}),['mxn']);
 assert.deepEqual(filter({currency:'MXN',min:'150'}),[]);
 assert.deepEqual(filter({currency:'HUF'}),[]);
 assert.equal(readLocationLandingFilters({min:'0.125'}).min,'0.125');
});
test('onboarding recovery preserves currency and old drafts default to their original euros',()=>{
 const draft={version:3,sections:{location:{...createQuickStartIntentData(),currency:'MXN',price:'1500',title:'Own studio'}},intents:['location']};
 const restored=normalizeQuickStartDraft(draft);
 assert.equal(restored.sections.location.currency,'MXN');assert.equal(restored.sections.location.price,'1500');
 delete draft.sections.location.currency;
 assert.equal(normalizeQuickStartDraft(draft).sections.location.currency,'EUR');
});
test('booking migration preserves historical amounts, snapshots new currencies, and retains access restrictions',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role anon;create role authenticated;create table bookings(id int primary key,total numeric not null);alter table bookings enable row level security;insert into bookings values(1,123.45);`);
  await pg.exec(readFileSync(new URL('../supabase/migrations/20261120194027_booking_currency_snapshot.sql',import.meta.url),'utf8'));
  assert.deepEqual((await pg.query('select total::text,currency from bookings where id=1')).rows,[{total:'123.45',currency:'EUR'}]);
  await pg.exec("insert into bookings values(2,1500,'MXN')");
  assert.equal((await pg.query('select currency from bookings where id=2')).rows[0].currency,'MXN');
  await assert.rejects(pg.exec("insert into bookings values(3,50,'x')"));
  assert.equal((await pg.query("select relrowsecurity as enabled from pg_class where oid='bookings'::regclass")).rows[0].enabled,true);
  await pg.exec('set role anon');await assert.rejects(pg.query('select * from bookings'));
 } finally {await pg.close();}
});
