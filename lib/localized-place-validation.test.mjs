import test from 'node:test';
import assert from 'node:assert/strict';
import {translatorFor} from './i18n-test-fixture.mjs';
import {SUPPORTED_LOCALES, appLocale, resolveLocale} from './i18n/locales.ts';
import {countryName, hasPlaceCity, matchesPlace, placeDisplay, placeOptions} from './places/core.ts';
import {placeWriteFields, resolvePlace} from './places/catalog.ts';
import {validateProfileSave} from './profile-save-validation.ts';
import {START_QUICK_START_DRAFT, validateQuickStartScreen} from './quick-start-flow.ts';

const cityId='geonames:2886242';
const canonical=placeWriteFields('Cologne, DE',cityId);
const cologne={de:'Köln',en:'Cologne',es:'Colonia',it:'Colonia',cs:'Kolín nad Rýnem',hu:'Köln',nl:'Keulen','nl-BE':'Keulen',sv:'Köln'};
for (const locale of SUPPORTED_LOCALES) {
  test(`${locale}: native validation keeps canonical IDs and distinguishes a country from a city`, () => {
    const t=translatorFor(locale);
    const errors=validateProfileSave({name:'',city:countryName('DE',locale),positions:[],profileTypes:[]},t);
    assert.deepEqual(errors,{name:t('Ui.text_f08a575aecfb55'),city:t('Ui.text_a4789c8ce64209'),activity:t('Ui.text_f25450253ed66e')});
    assert.equal(hasPlaceCity(countryName('DE',locale)),false);
    assert.deepEqual(validateProfileSave({name:'Márta',city:'Unlisted village, NZ',positions:[],profileTypes:['actor']},t),{});
    const draft={...START_QUICK_START_DRAFT,intents:['crew'],name:'Márta',personCity:countryName('DE',locale)};
    assert.deepEqual(validateQuickStartScreen(draft,'location',undefined,t),{field:'personCity',message:t('setup.cityRequired')});
    const before=JSON.stringify(canonical);
    const countries=placeOptions([canonical],'country',locale);
    const cities=placeOptions([canonical],'city',locale);
    assert.deepEqual(countries,[{value:'DE',label:countryName('DE',locale)}]);
    assert.equal(cities[0].value,cityId);
    assert.ok(cities[0].label.startsWith(cologne[locale]+', '));
    assert.equal(matchesPlace(canonical,'city',cityId),true);
    assert.equal(placeDisplay(canonical,'member text',locale),cologne[locale]+', '+countryName('DE',locale));
    assert.equal(JSON.stringify(canonical),before);
    assert.equal(resolveLocale(locale,'de;q=1,en;q=0.9'),locale,'explicit choice wins');
  });
}
test('international manual places survive and region-only entries never become a city option',()=>{
  const region=placeWriteFields('Bayern, DE');
  assert.equal(region.place_city_id,null);
  assert.equal(region.place_city_name,'');
  assert.deepEqual(placeOptions([region],'city','de'),[]);
  const pending=resolvePlace('Te Kōwhai, NZ');
  assert.equal(pending.status,'pending');
  assert.equal(pending.city,'Te Kōwhai');
  assert.equal(pending.countryCode,'NZ');
  assert.equal(pending.cityId,null);
  assert.equal(appLocale('nl_be'),'nl-BE');
  assert.equal(appLocale('sv-SE'),'sv');
  assert.equal(resolveLocale('invalid','sv-SE;q=0.9,cs;q=0.8'),'sv');
});
