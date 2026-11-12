import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Execute the current, unmodified implementation and real native catalogs without any service calls.
const root = process.env.CINEGENIUS_NOTIFICATION_SOURCE ?? fileURLToPath(new URL('../', import.meta.url));
const requireSource = createRequire(resolve(root, 'lib/i18n/notification-copy.ts'));
const {createTranslator} = requireSource('next-intl');
const ts = requireSource('typescript');
const {parse} = requireSource('@formatjs/icu-messageformat-parser');
const sourcePath = resolve(root, 'lib/i18n/notification-copy.ts');
const sourceCode = readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(sourceCode, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const moduleFixture = {exports:{}};
new Function('require','module','exports',compiled)(requireSource,moduleFixture,moduleFixture.exports);
const {canonicalNotification,localizedNotification,localizeNotification} = moduleFixture.exports;
const indexText = readFileSync(resolve(root,'lib/i18n/notification-index.json'),'utf8');
const index = JSON.parse(indexText);
const sha256=value=>createHash('sha256').update(value).digest('hex');
console.log('# fixture '+JSON.stringify({sourcePath,sourceSha256:sha256(sourceCode),indexSha256:sha256(indexText)}));
const sourceMessages = JSON.parse(readFileSync(resolve(root,'messages/de.json'),'utf8')).NotificationCopy;
const localeSource = readFileSync(resolve(root,'lib/i18n/locales.ts'),'utf8');
const locales = [...localeSource.match(/SUPPORTED_LOCALES = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(match=>match[1]);
assert.equal(locales.length,9,'exercise every supported reader locale');
const catalogues = Object.fromEntries(locales.map(locale=>[locale,JSON.parse(readFileSync(resolve(root,`messages/${locale}.json`),'utf8'))]));
const translatorFor = locale => createTranslator({locale,messages:catalogues[locale],namespace:'NotificationCopy',onError(error){throw error;}});
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const nested of Object.values(value))deepFreeze(nested);}return value;}
const stored = (type,fields={}) => deepFreeze({id:'notice-42-東京',user_id:'member-8',type,title:'Member title stays exact.',body:'Personal member text stays exact.',href:'/dashboard?ref=opaque%26value&lang=en#unchanged',read:false,created_at:'2026-11-01T12:00:00Z',opaque:{member:'A & B <private> {not_a_key}'},...fields});
function projectPreserving(original,translate){const before=JSON.stringify(original);const projected=localizeNotification(original,translate);assert.notEqual(projected,original,'presentation returns a separate row');assert.equal(JSON.stringify(original),before,'stored row is never mutated');for(const [field,value] of Object.entries(original)){if(field!=='title'&&field!=='body')assert.deepEqual(projected[field],value,`preserve ${field}`);}return projected;}
const values = {value0:'Márta 東京 ✓',value1:'Atlas Studios',value2:2,title:'Lumière studio',ref:'CG-0001/a&b',name:'Ana Zoë',company:'Atlas Films GmbH',roles:'Director'};
const tricky = [
  'Film als Kunst GmbH', 'Ana als Zoë', 'Studio „als“ “Quote” «α»',
  'Márta & Özgür <crew role="lead">東京</crew> {never_translate} 👩🏽‍🎬',
  'O’Connor "Müller" \\ / & < > = : ; | % + \n Unicode e\u0301',
];
const fillLegacy = (template,parameters) => template.replace(/\{(\w+)\}/g,(_match,name)=>String(parameters[name]));
const quiet = run => {const original=console.error;try{console.error=()=>{};return run();}finally{console.error=original;}};

for(const locale of locales){
  test(`${locale}: every structured template uses reader copy and preserves stored identity`,()=>{
    const real=translatorFor(locale);
    for(const [key,entry] of Object.entries(index)){
      const parameters={...values,value1:key==='n_35bffb78df4b'?2:values.value1};
      const content=localizedNotification({[entry.field]:{key,values:parameters}});
      assert.equal(content[entry.field],canonicalNotification(key,parameters),`${key}: canonical storage`);
      assert.deepEqual(content.localization,{version:1,[entry.field]:{key,values:parameters}});
      const original=stored(entry.types[0],{...content,read:entry.field==='body'});
      const calls=[];
      const projected=projectPreserving(original,(calledKey,calledValues)=>{calls.push({key:calledKey,values:calledValues});return real(calledKey,calledValues);});
      assert.equal(projected[entry.field],real(key,parameters),key);
      assert.deepEqual(calls,[{key,values:parameters}],`${key}: opaque interpolation arguments`);
      const untouched=entry.field==='body'?'title':'body';
      assert.equal(projected[untouched],original[untouched]);
    }
  });

  test(`${locale}: structured values preserve delimiter words, quotes, XML, Unicode and newlines exactly`,()=>{
    const real=translatorFor(locale);
    for(const company of tricky){
      const parameters={value0:tricky[3],value1:company,value2:tricky[2]};
      const content=localizedNotification({title:{key:'n_6f120a657c89'},body:{key:'n_4226c25553e7',values:parameters}});
      const original=stored('company_join_request',content);
      const calls=[];
      const projected=projectPreserving(original,(key,args)=>{calls.push([key,args]);return real(key,args);});
      assert.equal(projected.body,real('n_4226c25553e7',parameters));
      assert.deepEqual(calls.find(([key])=>key==='n_4226c25553e7')[1],parameters);
      for(const memberValue of Object.values(parameters))assert.ok(projected.body.includes(memberValue),`member value retained: ${memberValue}`);
    }
    for(const title of tricky){
      const parameters={title,ref:'CG "als" <&> {ref} 東京'};
      const original=stored('booking_request',localizedNotification({title:{key:'bookingSentTitle'},body:{key:'bookingSentBody',values:parameters}}));
      const projected=projectPreserving(original,real);
      assert.equal(projected.body,real('bookingSentBody',parameters));
      assert.ok(projected.body.includes(title));
      assert.ok(projected.body.includes(parameters.ref));
    }
  });

  test(`${locale}: unambiguous historical DE/EN/ES/IT/CS/HU booking and moderation templates localize`,()=>{
    const real=translatorFor(locale);
    for(const key of ['bookingSentTitle','bookingSentBody','bookingIncomingTitle','bookingIncomingBody','offerTitle','offerBody_approved','offerBody_hidden','offerBody_changes_requested','offerBody_rejected']){
      const entry=index[key];
      assert.equal(entry.legacyVariants.length,5,`${key}: six documented source languages`);
      for(const [sourceLanguage,template] of [entry.legacy,...entry.legacyVariants].entries()){
        const original=stored(entry.types[0],{[entry.field]:fillLegacy(template,values)});
        const projected=projectPreserving(original,real);
        assert.equal(projected[entry.field],real(key,values),`${key}: historical variant ${sourceLanguage}`);
      }
    }
  });

  test(`${locale}: every unambiguous canonical and German legacy template remains compatible`,()=>{
    const real=translatorFor(locale);
    for(const [key,entry] of Object.entries(index)){
      const parameters={...values,value1:key==='n_35bffb78df4b'?2:values.value1,legacySuffix:'en'};
      for(const text of [canonicalNotification(key,parameters),fillLegacy(entry.legacy,parameters)]){
        const original=stored(entry.types[0],{[entry.field]:text});
        assert.equal(projectPreserving(original,real)[entry.field],real(key,parameters),key);
      }
    }
  });

  test(`${locale}: 1, 2 and grouped 1.000 booking days stay numeric in structured and legacy copy`,()=>{
    const real=translatorFor(locale),key='n_35bffb78df4b';
    for(const count of [1,2,1000]){
      const parameters={value0:'Ana 東京',value1:count};
      const content=localizedNotification({body:{key,values:parameters}});
      if(count===1000)assert.match(content.body,/1\.000/,'actual canonical German grouping');
      for(const fields of [content,{body:content.body},{body:fillLegacy(index[key].legacy,{...parameters,value1:count===1000?'1.000':count})}]){
        const calls=[];
        const projected=projectPreserving(stored('booking_request',fields),(calledKey,args)=>{calls.push([calledKey,args]);return real(calledKey,args);});
        assert.equal(projected.body,real(key,parameters),`count ${count}`);
        const interpolation=calls.find(([calledKey])=>calledKey===key)[1];
        assert.equal(interpolation.value1,count);
        assert.equal(typeof interpolation.value1,'number');
      }
    }
  });

  test(`${locale}: ambiguous legacy splits and unknown/member copy are preserved`,()=>{
    const real=translatorFor(locale);
    const cases=[
      stored('company_join_request',{body:canonicalNotification('n_4226c25553e7',{value0:'Ana',value1:'Film als Kunst GmbH',value2:'Director'})}),
      stored('company_join_request',{body:canonicalNotification('n_4226c25553e7',{value0:'Ana möchte Anna',value1:'Atlas Films',value2:'Director'})}),
      stored('company_join_accepted',{body:canonicalNotification('n_88e04a64baa6',{value0:'Film als Kunst GmbH',value1:'Director'})}),
      stored('booking_request',{body:fillLegacy(index.bookingSentBody.legacy,{title:'Film“ wurde gesendet. Referenz: X',ref:'Reference-2'})}),
      stored('friend_request',{body:'Mi mensaje personal. Meine persönliche Nachricht. My own words.'}),
      stored('admin_custom',{body:canonicalNotification('bookingSentBody',values)}),
      stored('booking_request',{body:'Ana hat dein Inserat für 1.5 Tag(e) gebucht.'}),
      stored('booking_request',{body:'Ana hat dein Inserat für NaN Tag(e) gebucht.'}),
      stored('booking_request',{body:'x'.repeat(16001)}),
    ];
    for(const original of cases)assert.deepEqual(projectPreserving(original,real),original,original.body);
  });

  test(`${locale}: invalid, tampered or incompatible structured metadata cannot rewrite copy`,()=>{
    const real=translatorFor(locale),key='bookingSentBody';
    const canonical=canonicalNotification(key,values);
    const valid={version:1,body:{key,values:{...values}}};
    const bad=[
      {version:2,body:valid.body}, {version:'1',body:valid.body},
      {version:1,body:{key:'missing_notification_key',values}},
      {version:1,body:{key:'toString',values}},
      {version:1,body:{key:42,values}}, {version:1,body:{key:null,values}},
      {version:1,body:'not a structured template'}, {version:1,body:{key,values:'not an argument object'}},
      {version:1,body:{key:'bookingSentTitle',values}},
      {version:1,body:{key,values:{...values,title:'Changed member content'}}},
      {version:1,body:{key,values:{title:values.title}}},
      {version:1,body:{key}}, {version:1,body:{key,values:null}},
      {version:1,body:{key,values:[]}}, {version:1,body:[]},
      {version:1,body:{key,values:{...values,title:true}}},
      {version:1,body:{key,values:{...values,title:{text:'not a scalar'}}}},
      {version:1,body:{key,values:{...values,ref:NaN}}},
      {version:1,body:{key,values:{...values,ref:Infinity}}},
      {version:1,body:{key,values:{...values,title:'x'.repeat(16001)}}},
      {version:1,body:{key,values:Object.fromEntries(Array.from({length:13},(_,i)=>['key'+i,i]))}},
    ];
    for(const localization of bad){
      const original=stored('booking_request',{body:canonical,localization});
      const result=quiet(()=>projectPreserving(original,real));
      assert.deepEqual(result,original,JSON.stringify(localization));
    }
    const typeMismatch=stored('friend_request',{body:canonical,localization:valid});
    assert.deepEqual(projectPreserving(typeMismatch,real),typeMismatch);
    const changedOriginal=stored('booking_request',{body:'Member has replaced the original body.',localization:valid});
    assert.deepEqual(projectPreserving(changedOriginal,real),changedOriginal);
  });

  test(`${locale}: missing-value metadata attached to fallback-key text remains safe and unchanged`,()=>{
    const real=translatorFor(locale);
    for(const key of ['bookingSentBody','n_4226c25553e7','n_35bffb78df4b']){
      const original=stored(index[key].types[0],{body:'NotificationCopy.'+key,localization:{version:1,body:{key}}});
      let projected;
      assert.doesNotThrow(()=>quiet(()=>{projected=projectPreserving(original,real);}),'missing interpolation values must not reach the reader formatter');
      assert.deepEqual(projected,original);
    }
  });

  test(`${locale}: valid title metadata and invalid body metadata are handled independently`,()=>{
    const real=translatorFor(locale);
    const content=localizedNotification({title:{key:'bookingSentTitle'},body:{key:'bookingSentBody',values}});
    const original=stored('booking_request',{...content,localization:{...content.localization,body:{key:'unknown_template',values}}});
    const projected=projectPreserving(original,real);
    assert.equal(projected.title,real('bookingSentTitle'));
    assert.equal(projected.body,original.body);
    const inverse=stored('booking_request',{...content,localization:{...content.localization,title:{key:'unknown_template'}}});
    const inverseProjected=projectPreserving(inverse,real);
    assert.equal(inverseProjected.title,inverse.title);
    assert.equal(inverseProjected.body,real('bookingSentBody',values));
  });
}

test('structured writer rejects unknown template keys instead of producing invented copy',()=>{
  assert.throws(()=>localizedNotification({body:{key:'missing_notification_key'}}),/unknown_notification_template/);
});

test('fixture exercises real source, templates and declared numeric arguments',()=>{
  assert.ok(sourceCode.includes('export function localizedNotification('));
  assert.deepEqual(Object.keys(index).sort(), Object.keys(sourceMessages).sort(), 'every declared notification has an indexed template and vice versa');
  const ast=parse(sourceMessages.n_35bffb78df4b);
  assert.ok(ast.some(node=>node.type===6&&node.value==='value1'));
});
