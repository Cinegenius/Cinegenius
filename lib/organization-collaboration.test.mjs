import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {organizationTestBootstrap} from './test-fixtures/organization-database.mjs';
let pg;const token='a'.repeat(64),recipient='b'.repeat(64);
before(async()=>{pg=new PGlite();await pg.exec(organizationTestBootstrap);await pg.exec('alter table companies add owner_user_id text; create table company_members(company_id uuid,user_id text,role text,status text);');for(const file of ['20261103170000_organizations_and_news.sql','20261104150000_organization_collaboration.sql'])await pg.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));});
after(async()=>pg?.close());
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
async function org(){return(await pg.query("insert into organizations(owner_user_id,last_actor_user_id,responsible_user_id,slug,name) values('owner','owner','owner','test-org','Test organization') returning id")).rows[0].id;}
async function run(id,actor,action,target='',credential='',hashes=[]){return(await pg.query('select change_organization_access($1,$2,$3,$4,$5,$6) result',[id,actor,action,target,credential,hashes])).rows[0].result;}
async function deny(fn,code){await pg.exec('savepoint denied');await assert.rejects(fn,{code});await pg.exec('rollback to savepoint denied');}
test('invitation grants no access until matching verified recipient accepts; replay is rejected',()=>tx(async()=>{
 const id=await org();const invite=await run(id,'owner','invite',recipient,token);
 assert.equal((await pg.query('select count(*)::int n from organization_members')).rows[0].n,1);
 await deny(()=>run(id,'stranger','accept_invite',invite.id,token,['c'.repeat(64)]),'42501');
 await deny(()=>run(id,'recipient','accept_invite',invite.id,'d'.repeat(64),[recipient]),'42501');
 await run(id,'recipient','accept_invite',invite.id,token,[recipient]);
 assert.deepEqual((await pg.query("select role,status from organization_members where user_id='recipient'")).rows,[{role:'admin',status:'active'}]);
 await deny(()=>run(id,'recipient','accept_invite',invite.id,token,[recipient]),'PT409');
 assert.equal((await pg.query('select count(*)::int n from profiles')).rows[0].n,0);
 await deny(()=>run(id,'recipient','invite','e'.repeat(64),'f'.repeat(64)),'42501');
 await run(id,'recipient','leave');
 assert.equal((await pg.query("select status from organization_members where user_id='recipient'")).rows[0].status,'ended');
 await deny(()=>run(id,'owner','leave'),'42501');
}));
test('duplicate, expired, revoked and declined invitations cannot be accepted',()=>tx(async()=>{
 const id=await org();const invite=await run(id,'owner','invite',recipient,token);
 await deny(()=>run(id,'owner','invite',recipient,'c'.repeat(64)),'23505');
 await run(id,'owner','revoke_invite',invite.id);
 await deny(()=>run(id,'recipient','accept_invite',invite.id,token,[recipient]),'PT409');
 const second=await run(id,'owner','invite',recipient,'d'.repeat(64));
 await run(id,'recipient','decline_invite',second.id,'d'.repeat(64),[recipient]);
 await deny(()=>run(id,'recipient','accept_invite',second.id,'d'.repeat(64),[recipient]),'PT409');
 const third=await run(id,'owner','invite',recipient,'e'.repeat(64));
 await pg.query("update organization_invitations set expires_at=now()-interval '1 second' where id=$1",[third.id]);
 await deny(()=>run(id,'recipient','accept_invite',third.id,'e'.repeat(64),[recipient]),'PT409');
}));
test('company association requires company owner or accepted admin; grants no memberships',()=>tx(async()=>{
 const id=await org();const company=(await pg.query("insert into companies values(gen_random_uuid(),true,'company-owner') returning id")).rows[0].id;
 const link=await run(id,'owner','request_link',company);
 await deny(()=>run(id,'owner','accept_link',link.id),'42501');
 await pg.query("insert into company_members values($1,'editor','editor','accepted'),($1,'pending-admin','admin','pending')",[company]);
 for(const actor of ['stranger','editor','pending-admin'])await deny(()=>run(id,actor,'accept_link',link.id),'42501');
 await run(id,'company-owner','accept_link',link.id);
 assert.equal((await pg.query('select status from organization_company_links')).rows[0].status,'accepted');
 assert.equal((await pg.query('select count(*)::int n from organization_members')).rows[0].n,1);
 assert.equal((await pg.query('select count(*)::int n from company_members')).rows[0].n,2);
 await run(id,'owner','revoke_link',link.id);
 assert.equal((await pg.query('select status from organization_company_links')).rows[0].status,'revoked');
}));
test('missing company owner never authorizes strangers; accepted admin may confirm',()=>tx(async()=>{
 const id=await org();const company=(await pg.query('insert into companies values(gen_random_uuid(),true,null) returning id')).rows[0].id;
 const link=await run(id,'owner','request_link',company);
 await deny(()=>run(id,'stranger','accept_link',link.id),'42501');
 await pg.query("insert into company_members values($1,'company-admin','admin','accepted')",[company]);
 await run(id,'company-admin','accept_link',link.id);
}));
test('private company cannot be requested; parallel association is rejected',()=>tx(async()=>{
 const id=await org();const company=(await pg.query("insert into companies values(gen_random_uuid(),false,'co') returning id")).rows[0].id;
 await deny(()=>run(id,'owner','request_link',company),'PT409');
 await pg.query('update companies set published=true where id=$1',[company]);
 await run(id,'owner','request_link',company);
 await deny(()=>run(id,'owner','request_link',company),'23505');
}));
test('direct client access is denied and audit failure rolls back granting rights',()=>tx(async()=>{
 const id=await org();const invite=await run(id,'owner','invite',recipient,token);
 for(const role of ['anon','authenticated'])for(const table of ['organization_invitations','organization_company_links','organization_access_events'])assert.equal((await pg.query("select has_table_privilege($1,$2,'SELECT') allowed",[role,table])).rows[0].allowed,false);
 await pg.exec("alter table organization_access_events add constraint fail_audit check(action<>'accept_invite') not valid");
 await deny(()=>run(id,'recipient','accept_invite',invite.id,token,[recipient]),'23514');
 assert.equal((await pg.query('select count(*)::int n from organization_members')).rows[0].n,1);
 assert.equal((await pg.query('select status from organization_invitations')).rows[0].status,'pending');
}));
