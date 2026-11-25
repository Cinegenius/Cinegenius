import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{PGlite}from'@electric-sql/pglite';
test('five actual helper bodies retain privacy filters and outputs with a fixed search path and unchanged privileges',async()=>{
 const pg=new PGlite();const read=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
 try{await pg.exec(read('20261024190000_public_community_media.sql').split('create or replace view')[0]);await pg.exec(read('20261025151000_bound_discovery_query.sql').split('create or replace view')[0]);
 const place=read('20261109170000_canonical_places.sql').match(/create or replace function public\.place_record_key[\s\S]+?\$\$;/i)[0];await pg.exec(place);
 const queries=[
 ["select * from public.community_image_entries($1)",[JSON.stringify([{url:'public.jpg'},{url:'private.jpg',is_private:true},{url:'hidden.jpg',visibility:'private'}])]],
 ["select public.community_production_images($1) value",[JSON.stringify([{title:'Public credit',image_urls:['own.jpg']},{title:'Hidden',visibility:'private',image_urls:['no.jpg']}])]],
 ["select public.community_decode_path($1) value",['profile%20photo/%C3%A4.webp']],
 ["select public.community_decode_path($1) value",['broken%FF.webp']],
 ["select * from public.community_direct_image_entries($1,'profile')",[JSON.stringify([{url:'own.jpg'},{url:'company.jpg',source_type:'company'},{url:'project.jpg',project_id:'shared-project'}])]],
 ["select public.place_record_key('profiles',$1) value",[JSON.stringify({id:'row-id',user_id:'user_original'})]],
 ["select public.place_record_key('companies',$1) value",[JSON.stringify({id:'company-id',user_id:'user_other'})]],
 ];
 const before=[];for(const [q,p] of queries)before.push((await pg.query(q,p)).rows);
 const acl=(await pg.query("select proname,proacl,prosecdef from pg_proc where pronamespace='public'::regnamespace order by proname")).rows;
 await pg.exec(read('20261125172917_pin_privacy_helper_search_paths.sql'));
 await pg.exec('create schema hostile; set search_path=hostile,public,pg_catalog');
 for(const [index,[q,p]] of queries.entries())assert.deepEqual((await pg.query(q,p)).rows,before[index]);
 assert.deepEqual(before[0].map(x=>x.image_url),['public.jpg']);assert.deepEqual(before[4].map(x=>x.image_url),['own.jpg']);
 assert.deepEqual((await pg.query("select proname,proacl,prosecdef from pg_proc where pronamespace='public'::regnamespace order by proname")).rows,acl);
 const settings=(await pg.query("select proconfig from pg_proc where pronamespace='public'::regnamespace")).rows;assert.equal(settings.length,5);for(const row of settings)assert.deepEqual(row.proconfig,['search_path=pg_catalog']);
 }finally{await pg.close();}
});
