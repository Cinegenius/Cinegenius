import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = name => readFileSync(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
const fields = {title:'A project',type:'Kurzfilm',year:2026,images:[],place_status:'empty'};
const timestamp = '2026-11-13T12:00:00.000Z';
async function database() {
 const db = new PGlite();
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 await db.exec(sql('migrations/projects.sql'));
 await db.exec(sql('ghost-profiles-migration.sql'));
 await db.exec(sql('migrations/project_drafts.sql'));
 await db.exec(`ALTER TABLE projects ADD COLUMN place_country_code text, ADD COLUMN place_region_id text, ADD COLUMN place_city_id text, ADD COLUMN place_city_name text, ADD COLUMN place_region_name text, ADD COLUMN place_status text NOT NULL DEFAULT 'pending', ADD COLUMN place_original text;`);
 await db.exec(sql('migrations/20261113190610_atomic_project_publication.sql'));
 return db;
}
async function draft(db, data = {}, source = null) {
 return (await db.query('INSERT INTO project_drafts(user_id,draft_data,source_project_id,updated_at) VALUES ($1,$2,$3,$4) RETURNING id',['owner',JSON.stringify({title:'A project',type:'Kurzfilm',...data}),source,timestamp])).rows[0].id;
}
async function publish(db,id,{actor='owner',version=timestamp,metadata={}}={}) {
 return (await db.query('SELECT publish_project_draft($1,$2,$3,$4,$5) AS id',[actor,id,version,JSON.stringify(fields),JSON.stringify(metadata)])).rows[0].id;
}

test('private draft publishes project, own credit and crew together; retries return the same project',async()=>{
 const db=await database();try {
 const id=await draft(db,{myRole:'2nd AC',crew_entries:[{name:'Alex',role:'Art Director'}]});
 const project=await publish(db,id,{metadata:{project_details:{verified:true,status:'postproduktion'}}});
 assert.equal(await publish(db,id,{version:'2020-01-01'}),project);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM projects')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM project_credits')).rows[0].n,2);
 assert.equal((await db.query('SELECT metadata FROM projects')).rows[0].metadata.project_details.verified,false);
 assert.equal((await db.query('SELECT published_project_id FROM project_drafts')).rows[0].published_project_id,project);
 }finally{await db.close();}
});

test('failure after project insertion rolls back all publication writes and leaves retryable private draft',async()=>{
 const db=await database();try {
 const id=await draft(db,{myRole:'Camera'});
 await db.exec("ALTER TABLE project_credits ADD CONSTRAINT test_failure CHECK(role <> 'Camera');");
 await assert.rejects(publish(db,id),e=>e.code==='23514');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM projects')).rows[0].n,0);
 assert.equal((await db.query('SELECT published_project_id FROM project_drafts')).rows[0].published_project_id,null);
 await db.exec('ALTER TABLE project_credits DROP CONSTRAINT test_failure');
 assert.ok(await publish(db,id));
 }finally{await db.close();}
});

test('another member and stale draft cannot publish; browser database roles cannot execute publication',async()=>{
 const db=await database();try {
 const id=await draft(db);
 await assert.rejects(publish(db,id,{actor:'stranger'}),e=>e.code==='PT404');
 await assert.rejects(publish(db,id,{version:'2020-01-01'}),e=>e.code==='PT409');
 for(const role of ['anon','authenticated']){
 await db.exec(`SET ROLE ${role}`);
 await assert.rejects(publish(db,id),e=>e.code==='42501');
 await db.exec('RESET ROLE');
 }
 assert.equal((await db.query('SELECT count(*)::int AS n FROM projects')).rows[0].n,0);
 }finally{await db.close();}
});

test('owner revision removes old verification, preserves other credits, and blocks overwrite of newer content',async()=>{
 const db=await database();try {
 const source=(await db.query('INSERT INTO projects(title,type,created_by,updated_at,metadata) VALUES ($1,$2,$3,$4,$5) RETURNING id',['Original','Kurzfilm','owner',timestamp,{project_details:{verified:true}}])).rows[0].id;
 await db.query('INSERT INTO project_credits(project_id,user_id,role) VALUES ($1,$2,$3)',[source,'another-member','Art Director']);
 const id=await draft(db,{updated_at:timestamp},source);
 assert.equal(await publish(db,id,{metadata:{project_details:{verified:true}}}),source);
 assert.equal((await db.query('SELECT metadata FROM projects')).rows[0].metadata.project_details.verified,false);
 assert.equal((await db.query('SELECT role FROM project_credits')).rows[0].role,'Art Director');
 const stale=await draft(db,{updated_at:timestamp},source);
 await assert.rejects(publish(db,stale),e=>e.code==='PT409');
 assert.equal((await db.query('SELECT title FROM projects')).rows[0].title,'A project');
 }finally{await db.close();}
});

test('same names in unrelated projects are not silently merged into another person',async()=>{
 const db=await database();try {
 await db.query('INSERT INTO unclaimed_profiles(name,slug,created_by) VALUES ($1,$2,$3)',['Alex','alex-existing','other']);
 const id=await draft(db,{crew_entries:[{name:'Alex',role:'Art Director'},{name:'Alex',role:'Art Director'}]});
 await publish(db,id);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM unclaimed_profiles')).rows[0].n,2);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM project_credits')).rows[0].n,1);
 }finally{await db.close();}
});


test('an earlier partial publication is never silently acknowledged over newer public edits',async()=>{
 const db=await database();try {
 const id=await draft(db);
 await db.query('INSERT INTO projects(title,type,created_by,metadata) VALUES ($1,$2,$3,$4)', ['Newer public edit','Kurzfilm','owner',{draft_id:id}]);
 await assert.rejects(publish(db,id),e=>e.code==='PT409');
 assert.equal((await db.query('SELECT title FROM projects')).rows[0].title,'Newer public edit');
 assert.equal((await db.query('SELECT published_project_id FROM project_drafts')).rows[0].published_project_id,null);
 }finally{await db.close();}
});
