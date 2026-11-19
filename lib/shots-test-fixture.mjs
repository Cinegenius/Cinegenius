import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
export async function shotsFixture(){
 const pg=new PGlite(),objects=new Map(),calls=[];const state={actor:'alice',upload:'ok',remove:'ok',rate:true,onDownload:null,privateBucket:true};
 await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;CREATE TABLE user_settings(user_id text PRIMARY KEY,ghost_mode boolean DEFAULT false);CREATE TABLE blocks(blocker_id text,blocked_id text);CREATE TABLE friendships(id uuid DEFAULT gen_random_uuid(),sender_id text,receiver_id text,status text,sender_favorite boolean DEFAULT false,receiver_favorite boolean DEFAULT false);GRANT SELECT ON storage.buckets,public.user_settings,public.blocks,public.friendships TO service_role;GRANT USAGE ON SCHEMA storage TO service_role;`);
 const name=readdirSync('supabase/migrations').find(n=>n.endsWith('_shots_ephemeral_v1.sql'));await pg.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 await pg.exec('UPDATE shots_private.config SET enabled=true,cleanup_ready=true,worker_seen_at=clock_timestamp()');
 const bucket={
  async upload(key,bytes,options){calls.push({kind:'upload',key,options});if(state.upload==='fail')throw Error('fixture unknown ACK');if(objects.has(key))return{data:null,error:{status:409}};objects.set(key,Buffer.from(bytes));if(state.upload==='lost')return{data:null,error:{status:503}};return{data:{path:key},error:null}},
  async download(key){calls.push({kind:'download',key});if(state.onDownload)await state.onDownload(key);return objects.has(key)?{data:new Blob([objects.get(key)]),error:null}:{data:null,error:{status:404}}},
  async remove(keys){calls.push({kind:'remove',keys});if(state.remove==='fail')return{data:null,error:{status:503}};for(const key of keys)objects.delete(key);if(state.remove==='lost')throw Error('fixture unknown deletionACK');return{data:keys.map(name=>({name})),error:null}},
  async exists(key){calls.push({kind:'exists',key});return objects.has(key)?{data:true,error:null}:{data:false,error:{status:404}}},
 };
 const mocks={
  'server-only':{},'@/lib/auth':{getCurrentUser:async()=>state.actor?{userId:state.actor}:null},'@/lib/rateLimit':{rateLimit:async()=>({allowed:state.rate})},
  '@/lib/db':{db:{rpc(name,args){if(name!=='shots_v1')throw Error('Unexpected RPC');return{async abortSignal(){calls.push({kind:'rpc',action:args.p_action});try{return{data:(await pg.query('SELECT shots_v1($1,$2,$3::jsonb) result',[args.p_action,args.p_actor,JSON.stringify(args.p)])).rows[0].result,error:null}}catch{return{data:null,error:{code:'FIXTURE_SQL_FAILURE'}}}}}},storage:{from(name){if(name!=='shots-ephemeral-v1')throw Error('Foreign bucket');return bucket},async getBucket(){return{data:{id:'shots-ephemeral-v1',public:!state.privateBucket},error:null}}}}},
 };
 const allowed=new Set(['lib/shots.ts','lib/shots-server.ts','lib/shots-cleanup.ts','lib/uploadGuard.ts','lib/upload-limits.ts','lib/request-origin.ts','lib/listing-freshness-cron-auth.ts','app/api/internal/shots-cleanup/route.ts']);
 const context=vm.createContext({Buffer,File,Blob,Request,Response,Headers,FormData,URL,URLSearchParams,AbortSignal,Uint8Array,TextEncoder,TextDecoder,setTimeout,clearTimeout,process:{env:{NODE_ENV:'test',CRON_SECRET:'fixture-secret'}},console:{error(){throw Error('Unexpected raw console logging')}}});
 const modules=new Map();function load(file){if(modules.has(file))return modules.get(file).exports;if(!allowed.has(file))throw Error('Unexpected source '+file);const mod={exports:{}};modules.set(file,mod);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const resolve=id=>{if(id in mocks)return mocks[id];if(id.startsWith('@/'))return load(id.slice(2)+'.ts');if(id.startsWith('.'))return load(path.posix.normalize(path.posix.join(path.posix.dirname(file),id))+'.ts');return require(id)};
  new vm.Script('(function(require,module,exports){'+code+'\n})',{filename:file}).runInContext(context)(resolve,mod,mod.exports);return mod.exports;
 }
 return{pg,objects,calls,state,api:load('lib/shots-server.ts'),cleanup:load('lib/shots-cleanup.ts'),worker:load('app/api/internal/shots-cleanup/route.ts'),async close(){await pg.close()}};
}
export const shotHeaders=(actor='alice')=>({'X-CineGenius-Shots-Contract':'cinegenius.shots.v1','X-Shots-Account':actor,Origin:'https://cinegenius.co'});
export function shotRequest(url,actor='alice',options={}){return new Request('https://cinegenius.co'+url,{...options,headers:{...shotHeaders(actor),...options.headers}})}
