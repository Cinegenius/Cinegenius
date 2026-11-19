import "server-only";
import { db } from "@/lib/db";
import { isShotId } from "./shots";
const BUCKET="shots-ephemeral-v1";
type CleanupJob={id:string;token:string;paths:{key:string;variant:'full'|'thumbnail'}[]};
export type ShotsCleanupDependencies={
  privateBucket:()=>Promise<boolean>;
  rpc:(action:string,input?:Record<string,unknown>)=>Promise<Record<string,unknown>>;
  remove:(keys:string[])=>Promise<unknown>;
  absent:(key:string)=>Promise<boolean>;
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function readShotCleanupJob(value:unknown):CleanupJob{
  if(!object(value)||!isShotId(value.id)||!isShotId(value.token)||!Array.isArray(value.paths)||value.paths.length!==2)throw new Error('unavailable');
  const id=value.id,variants=new Set<string>();
  for(const path of value.paths){if(!object(path)||(path.variant!=='full'&&path.variant!=='thumbnail')||path.key!==`${id}/${path.variant}.webp`||variants.has(path.variant))throw new Error('unavailable');variants.add(path.variant)}
  return value as unknown as CleanupJob;
}
const defaults:ShotsCleanupDependencies={
  async privateBucket(){const result=await db.storage.getBucket(BUCKET);return !result.error&&result.data?.id===BUCKET&&result.data.public===false},
  async rpc(action,input={}){const result=await db.rpc('shots_v1',{p_action:action,p_actor:null,p:input}).abortSignal(AbortSignal.timeout(12_000));if(result.error||!object(result.data))throw new Error('unavailable');return result.data},
  async remove(keys){return db.storage.from(BUCKET).remove(keys)},
  async absent(key){const result=await db.storage.from(BUCKET).exists(key);if(result.data!==false)return false;if(!result.error)return true;return 'status'in result.error&&result.error.status===404},
};
/** Durable claims survive a crash. No row/job is purged before every object is confirmed absent. */
export async function runShotsCleanup(dependencies:ShotsCleanupDependencies=defaults){
  if(!await dependencies.privateBucket()){try{await dependencies.rpc('cleanup_failed')}catch{}throw new Error('unavailable')}
  const claimed=await dependencies.rpc('cleanup_claim');if(claimed.status!=='ok'||!Array.isArray(claimed.jobs)||claimed.jobs.length>10)throw new Error('unavailable');
  // Validate the entire response before issuing even one destructive storage call.
  const jobs=claimed.jobs.map(readShotCleanupJob);let purged=0,retry=0;
  for(const job of jobs){
    const keys=job.paths.map(path=>path.key);
    try{
      try{await dependencies.remove(keys)}catch{/* Unknown ACK: only an authoritative absence check can settle it. */}
      for(const key of keys)if(!await dependencies.absent(key))throw new Error('unavailable');
      const result=await dependencies.rpc('cleanup_finish',{id:job.id,token:job.token,removed:keys});
      if(result.status!=='done')throw new Error('unavailable');purged++;
    }catch{
      retry++;
      // Failure to record a retry leaves the existing lease recoverable. Never invent success.
      try{await dependencies.rpc('cleanup_retry',{id:job.id,token:job.token})}catch{}
    }
  }
  if(retry){await dependencies.rpc('cleanup_failed');return{processed:jobs.length,purged,retry,healthy:false}}
  const completed=await dependencies.rpc('cleanup_complete');if(completed.status!=='healthy'&&completed.status!=='backlog')throw new Error('unavailable');
  return{processed:jobs.length,purged,retry,healthy:completed.status==='healthy'};
}
