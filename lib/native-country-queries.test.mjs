import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import * as country from './browse-country.ts';
import {UNASSIGNED_COUNTRY} from './places/core.ts';
import * as places from './places/catalog.ts';
import * as taxonomy from './organization-taxonomy.ts';
import * as region from './news-region.ts';
import {translatorFor} from './i18n-test-fixture.mjs';

const owner='user_CountryOwner', hidden='user_Hidden', visible='user_Visible';
const json=value=>JSON.parse(JSON.stringify(value));
function load(file,mocks){
  const module={exports:{}};
  const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',source)(id=>{assert.ok(Object.hasOwn(mocks,id),'Unexpected dependency '+id);return mocks[id];},module,module.exports);
  return module.exports;
}
const identifier=value=>{assert.match(value,/^[a-z_]+$/);return '"'+value+'"';};
function splitTopLevel(text){
  const values=[];let start=0,depth=0,quoted=false;
  for(let i=0;i<text.length;i++){
    if(text[i]==='"'&&text[i-1]!=='\\')quoted=!quoted;
    if(!quoted){if(text[i]==='(')depth++;if(text[i]===')')depth--;if(text[i]===','&&depth===0){values.push(text.slice(start,i));start=i+1;}}
  }
  values.push(text.slice(start));return values;
}

async function fixture({actor=owner,ghosts=[owner,hidden],locale='de',failTable}={}){
  const pg=new PGlite();
  await pg.exec(`
    create table organizations(id text primary key,slug text,name text,logo_url text,city text,place_country_code text,
      moderation_status text,created_at timestamptz,public_contact_email text default 'private-canary');
    create table community_posts(id text primary key,author_id text,kind text,title text,body text,city text,
      created_at timestamptz,expires_at timestamptz,place_country_code text,place_region_id text,place_city_id text,
      place_city_name text,place_region_name text,place_status text default 'pending',place_original text default 'private-journal');
    create table profiles(user_id text primary key,display_name text,avatar_url text);
    create table community_replies(post_id text);
  `);
  const calls=[];
  const db={from(table){
    assert.ok(['organizations','community_posts','profiles','community_replies'].includes(table));
    const state={table,columns:[],conditions:[],orders:[],limit:null,offset:0,events:[]};calls.push(state);
    const query={
      select(columns){state.columns=columns.split(',');state.events.push('select');return query;},
      eq(column,value){state.conditions.push({column,op:'eq',value});state.events.push(['eq',column,value]);return query;},
      gt(column,value){state.conditions.push({column,op:'gt',value});state.events.push(['gt',column]);return query;},
      in(column,value){state.conditions.push({column,op:'in',value});state.events.push(['in',column]);return query;},
      or(value){state.conditions.push({op:'or',value});state.events.push(['or',value]);return query;},
      order(column,options={}){state.orders.push([column,options.ascending!==false]);state.events.push('order');return query;},
      limit(value){assert.ok(Number.isInteger(value));state.limit=value;state.events.push('limit');return query;},
      range(start,end){assert.ok(Number.isInteger(start)&&Number.isInteger(end)&&end>=start);state.offset=start;state.limit=end-start+1;state.events.push('range');return query;},
      then(resolve,reject){return (async()=>{
        if(table===failTable)return {data:null,error:{code:'TEST_FAILURE'}};
        const values=[];const bind=value=>{values.push(value);return '$'+values.length;};
        const expression=(column,op,value)=>{
          const name=identifier(column);
          if(op==='eq')return `${name} = ${bind(value)}`;
          if(op==='gt')return `${name} > ${bind(value)}`;
          if(op==='is'){assert.equal(value,'null');return `${name} is null`;}
          if(op==='ilike')return `${name} ilike ${bind(value)}`;
          if(op==='in'){const items=Array.isArray(value)?value:value.slice(1,-1).split(',');return items.length?`${name} in (${items.map(bind).join(',')})`:'false';}
          throw new Error('Unexpected read operator '+op);
        };
        const clauses=state.conditions.map(filter=>filter.op==='or'?'('+splitTopLevel(filter.value).map(part=>{
          const match=part.match(/^([a-z_]+)\.(eq|is|ilike|in)\.(.*)$/);assert.ok(match,'Unsupported production filter '+part);
          let value=match[3];if(value.startsWith('"'))value=JSON.parse(value);
          return expression(match[1],match[2],value);
        }).join(' or ')+')':expression(filter.column,filter.op,filter.value));
        let sql='select '+state.columns.map(identifier).join(',')+' from '+identifier(table);
        if(clauses.length)sql+=' where '+clauses.join(' and ');
        if(state.orders.length)sql+=' order by '+state.orders.map(([column,ascending])=>identifier(column)+(ascending?' asc':' desc')).join(',');
        if(state.limit!==null)sql+=' limit '+state.limit;
        if(state.offset)sql+=' offset '+state.offset;
        const result=await pg.query(sql,values);return {data:result.rows,error:null};
      })().then(resolve,reject);},
    };
    return query;
  }};
  const service=load('lib/organization-discovery.ts',{'server-only':{},'@/lib/db':{db},'@/lib/news-discovery':{},'@/lib/news-region':region,'@/lib/places/core':{UNASSIGNED_COUNTRY},'@/lib/organization-taxonomy':taxonomy,'@/lib/browse-country':country});
  class NextResponse extends Response {static json(body,init={}){return new NextResponse(JSON.stringify(body),{...init,headers:{'Content-Type':'application/json',...init.headers}});}}
  const route=load('app/api/community-posts/route.ts',{
    '@/lib/profile-privacy-server':{ghostProfileIds:async()=>new Set(ghosts)},'next-intl/server':{getLocale:async()=>locale,getTranslations:async()=>translatorFor(locale)},
    '@/lib/places/catalog':places,'@/lib/db':{db},'@/lib/auth':{requireAuth:()=>{throw new Error('POST must not be called');}},
    '@/lib/rateLimit':{rateLimit:()=>{throw new Error('POST must not be called');}},'@clerk/nextjs/server':{auth:async()=>({userId:actor})},
    'next/server':{NextResponse},'@/lib/browse-country':country,'@/lib/places/core':{UNASSIGNED_COUNTRY},
  });
  const request=query=>({nextUrl:new URL('https://example.test/api/community-posts'+query)});
  async function org(id,countryCode,options={}){
    await pg.query('insert into organizations(id,slug,name,logo_url,city,place_country_code,moderation_status,created_at) values($1,$1,$2,null,$3,$4,$5,$6)',[id,'Organization '+id,options.city??'Paris',countryCode,options.status??'approved',options.createdAt??'2026-01-01T00:00:00Z']);
  }
  async function post(id,countryCode,options={}){
    await pg.query('insert into community_posts(id,author_id,kind,title,body,city,place_country_code,created_at,expires_at,place_status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,\'pending\')',[id,options.author??visible,options.kind??'offer',options.title??'Beacon set support',options.body??'Public board content',options.city??'Paris',countryCode,options.createdAt??'2026-01-01T00:00:00Z',options.expired?'2000-01-01T00:00:00Z':'2099-01-01T00:00:00Z']);
  }
  return {pg,calls,service,route,request,org,post};
}

test('organization country is applied in SQL before bounded paging, including older matches beyond first24',async()=>{
  const f=await fixture();try{
    for(let i=0;i<30;i++)await f.org('new-de-'+i,'DE',{createdAt:'2026-11-01T00:00:00Z'});
    for(let i=0;i<14;i++)await f.org('old-at-'+String(i).padStart(2,'0'),'AT');
    await f.org('private-at','AT',{status:'pending',createdAt:'2026-12-01T00:00:00Z'});
    const first=await f.service.organizationDiscovery(1,6,'AT');assert.equal(first.organizations.length,6);assert.ok(first.organizations.every(row=>row.id.startsWith('old-at-')));assert.equal(first.hasMore,true);
    const second=await f.service.organizationDiscovery(2,6,'AT');assert.equal(second.organizations.length,6);assert.ok(second.organizations.every(row=>row.id.startsWith('old-at-')));assert.ok(!first.organizations.some(row=>second.organizations.some(next=>next.id===row.id)));
    const de=await f.service.organizationDiscovery(1,6,'DE');assert.ok(de.organizations.every(row=>row.id.startsWith('new-de-')));
    const all=await f.service.organizationDiscovery(1,6,'all');assert.ok(all.organizations.every(row=>row.id.startsWith('new-de-')));
    const query=f.calls[0];assert.ok(query.events.findIndex(event=>Array.isArray(event)&&event[0]==='eq'&&event[1]==='place_country_code')<query.events.indexOf('range'));
    assert.deepEqual(query.columns,['id','slug','name','logo_url','city']);assert.ok(!JSON.stringify(first).includes('private-canary'));
  }finally{await f.pg.close();}
});

test('organization neutral matches only null/empty structured countries and never infers a city country',async()=>{
  const f=await fixture();try{
    await f.org('null',null,{city:'Paris'});await f.org('empty','',{city:'Berlin'});await f.org('de','DE',{city:'Vienna'});await f.org('at','AT',{city:'Munich'});
    const result=await f.service.organizationDiscovery(1,24,UNASSIGNED_COUNTRY);
    assert.deepEqual(json(result.organizations.map(row=>row.id).sort()),['empty','null']);
    const missing=await f.service.organizationDiscovery(1,24,'CH');assert.equal(missing.organizations.length,0);assert.equal(missing.hasMore,false);
    const before=f.calls.length;await assert.rejects(()=>f.service.organizationDiscovery(1,24,'DE,or(id.eq.private)'));assert.equal(f.calls.length,before,'invalid text must not become a database filter');
  }finally{await f.pg.close();}
});

test('organization failures remain unavailable, never a fabricated empty country result',async()=>{
  const f=await fixture({failTable:'organizations'});try{await assert.rejects(()=>f.service.organizationDiscovery(1,12,'AT'),/unavailable/);}finally{await f.pg.close();}
});

test('board SQL country/kind/text/expiry conditions run before the50-row limit and preserve the public projection',async()=>{
  const f=await fixture();try{
    for(let i=0;i<55;i++)await f.post('new-de-'+i,'DE',{createdAt:'2026-11-01T00:00:00Z'});
    for(let i=0;i<4;i++)await f.post('old-at-'+i,'AT');
    await f.post('wrong-kind','AT',{kind:'question'});await f.post('wrong-text','AT',{title:'Different offer',body:'No matching phrase'});await f.post('expired','AT',{expired:true});
    const response=await f.route.GET(f.request('?country=AT&kind=offer&q=Beacon&limit=500'));assert.equal(response.status,200);
    const payload=await response.json();assert.equal(payload.posts.length,4);assert.ok(payload.posts.every(row=>row.id.startsWith('old-at-')&&row.place_country_code==='AT'&&row.kind==='offer'));
    assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');assert.ok(!JSON.stringify(payload).includes('private-journal'));assert.ok(!JSON.stringify(payload).includes('author_id'));
    const query=f.calls.find(call=>call.table==='community_posts');assert.equal(query.limit,50);const limit=query.events.indexOf('limit');assert.ok(query.events.findIndex(event=>Array.isArray(event)&&event[0]==='eq'&&event[1]==='place_country_code')<limit);assert.ok(query.events.findIndex(event=>Array.isArray(event)&&event[0]==='eq'&&event[1]==='kind')<limit);
  }finally{await f.pg.close();}
});

test('board countries preserve ghost filtering, own-ghost exception, neutral and empty/all behavior',async()=>{
  const f=await fixture();try{
    await f.post('visible-de','DE');await f.post('hidden-de','DE',{author:hidden});await f.post('own-de','DE',{author:owner});await f.post('at','AT');await f.post('null',null);await f.post('empty','');
    let payload=await (await f.route.GET(f.request('?country=DE&limit=50'))).json();assert.deepEqual(payload.posts.map(row=>row.id).sort(),['own-de','visible-de']);assert.equal(payload.posts.find(row=>row.id==='own-de').is_mine,true);
    payload=await (await f.route.GET(f.request('?country=unassigned&limit=50'))).json();assert.deepEqual(payload.posts.map(row=>row.id).sort(),['empty','null']);
    assert.equal((await (await f.route.GET(f.request('?country=CH'))).json()).posts.length,0);
    const all=await (await f.route.GET(f.request('?country=all&limit=50'))).json();const omitted=await (await f.route.GET(f.request('?limit=50'))).json();assert.deepEqual(all,omitted);assert.equal(all.posts.length,5);
  }finally{await f.pg.close();}
});

test('neutral country and text OR groups intersect rather than broadening to matching located posts',async()=>{
  const f=await fixture();try{
    await f.post('neutral-match',null);
    await f.post('neutral-no-text','',{title:'Different offer',body:'A separate subject'});
    await f.post('located-match','DE');
    await f.post('neutral-wrong-kind','',{kind:'question'});
    const response=await f.route.GET(f.request('?country=unassigned&q=Beacon&kind=offer&limit=50'));
    assert.equal(response.status,200);assert.deepEqual((await response.json()).posts.map(row=>row.id),['neutral-match']);
    const query=f.calls.find(call=>call.table==='community_posts');
    assert.equal(query.conditions.filter(condition=>condition.op==='or').length,2,'the null/empty country OR and searchable-field OR are separate AND conditions');
  }finally{await f.pg.close();}
});

test('signed-out board reads cannot retain the previous account own-ghost exception',async()=>{
  const f=await fixture({actor:null});try{await f.post('ghost-owner','DE',{author:owner});await f.post('visible','DE');const payload=await (await f.route.GET(f.request('?country=DE'))).json();assert.deepEqual(payload.posts.map(row=>row.id),['visible']);assert.equal(payload.posts[0].is_mine,false);}finally{await f.pg.close();}
});

test('invalid and repeated country parameters fail as localized400 before any database read',async()=>{
  const f=await fixture();try{
    for(const query of ['?country=not-a-country','?country=DE%2Cor(id.eq.fake)','?country=DE&country=AT']){
      const response=await f.route.GET(f.request(query));assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:translatorFor('de')('Places.invalid')});assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
    }
    assert.equal(f.calls.length,0);
  }finally{await f.pg.close();}
});
