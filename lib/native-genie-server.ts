import "server-only";
import {createHmac} from "node:crypto";
import {auth} from "@clerk/nextjs/server";
import {getCurrentUser} from "@/lib/auth";
import {trustedMutationOrigin} from "@/lib/request-origin";
import {genieConfiguration,reserveGenieUsage} from "@/lib/genie-server";
import {verifyNativePushSession} from "@/lib/native-push-server";
import {rateLimit} from "@/lib/rateLimit";
import {createNativeGenieEngine,nativeGenieEngineError,validateNativeGenieInput} from "@/lib/native-genie-engine.mjs";

export const NATIVE_GENIE_CONTRACT="personal-test.v1";
const MAX_BYTES=4*1024*1024;
const headers={"Cache-Control":"private, no-store, max-age=0","CDN-Cache-Control":"no-store","Vercel-CDN-Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
class NativeGenieError extends Error{constructor(readonly code:string,readonly status=503){super(code);}}
function fail(code:string,status=503):never{throw new NativeGenieError(code,status);}
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value);
// An instance-local single flight supplements the durable per-account minute
// guard. It is not a distributed lock or a currency budget.
const inFlight=new Map<string,symbol>();
type Engine=(kind:string,input:unknown,options:{signal:AbortSignal;beforeProvider:()=>Promise<void>})=>Promise<unknown>;
// Only the provider adapter/model-access check is cached. No source, account
// session, permission decision or analysis result is retained here.
let providerEngine:{digest:string;engine:Engine}|undefined;

async function readInput(request:Request):Promise<unknown>{
 if(request.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase()!=="application/json"||!request.body)fail("invalid_request",400);
 const length=request.headers.get("content-length");
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BYTES))fail("too_large",413);
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){request.signal.throwIfAborted();const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)fail("too_large",413);chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}catch{fail("invalid_request",400);}
}

export async function nativeGenieRoute(request:Request,kind:string):Promise<Response>{
 const started=Date.now();
 let phase="access";
 let actor:string|null=null,releaseClaim:(()=>void)|undefined;
 const json=(body:unknown,status=200,diagnostic?:{rejectionStage?:unknown;rejectionReason?:unknown;rejectionArea?:unknown;rejectionRule?:unknown})=>{
  if(status>=500){
   // Only closed diagnostics: never log source, model output, identity, headers,
   // provider messages or exception stacks. Observation cannot affect response.
   const allowed=["unavailable","invalid_configuration","invalid_schema","invalid_evidence","provider_incomplete","provider_failed","provider_invalid_response","provider_empty_response","provider_unavailable","provider_timeout","too_large"];
   const candidate=object(body)?body.error:null;
   const code=typeof candidate==="string"&&allowed.includes(candidate)?candidate:"unclassified";
   let rejectionStage='unknown',rejectionReason='other',rejectionArea='unknown',rejectionRule='unknown';
   try{
    const rawStage=diagnostic?.rejectionStage,rawReason=diagnostic?.rejectionReason,rawArea=diagnostic?.rejectionArea,rawRule=diagnostic?.rejectionRule;
    const stage=typeof rawStage==="string"&&["compact_wire","canonical_validation","recovery","provider","unknown"].includes(rawStage)?rawStage:"unknown";
    const reason=typeof rawReason==="string"&&["duplicate_key","wire_schema_mismatch","invalid_union","wire_configuration","canonical_schema","recovery_schema","other"].includes(rawReason)?rawReason:"other";
    const area=typeof rawArea==="string"&&["root","day","people","times","locations","notes","contacts","unknown"].includes(rawArea)?rawArea:"unknown";
    const rule=stage==='canonical_validation'&&code==='invalid_schema'&&typeof rawRule==='string'&&['record_id_invalid','record_id_duplicate','audience_form','audience_duplicate_reference','unknown'].includes(rawRule)?rawRule:'unknown';
    rejectionStage=stage;rejectionReason=reason;rejectionArea=area;rejectionRule=rule;
   }catch{/* Diagnostic access must not change the HTTP response. */}
   try{console.error(JSON.stringify({rejectionStage,rejectionReason,rejectionArea,rejectionRule,event:"native_genie_failure",kind:["personal-dispo","work-task","analyze"].includes(kind)?kind:"unknown",phase,code,status,elapsedMs:Math.max(0,Date.now()-started)}));}catch{}
  }
  return Response.json(body,{status,headers:{...headers,...(status===200&&actor?{"X-CineGenius-Genie-Account":actor}:{}),...(status===429?{"Retry-After":"60"}:{})}});
 };
 try{
  const url=new URL(request.url);
  if(!["analyze","personal-dispo","work-task"].includes(kind)||url.pathname!=="/api/native/v1/genie/"+kind||url.search)fail("not_found",404);
  if(request.method!=="POST")fail("method_not_allowed",405);
  const origin=request.headers.get("origin"),referer=request.headers.get("referer");
  if(origin!==null?origin!==url.origin:referer===null||new URL(referer).origin!==url.origin)fail("invalid_request",403);
  if(!trustedMutationOrigin({requestUrl:request.url,origin,referer,development:process.env.NODE_ENV!=="production",deploymentHost:process.env.VERCEL_URL}))fail("invalid_request",403);
  actor=(await getCurrentUser())?.userId??null;
  const identity=await auth();
  if(!actor||identity.userId!==actor||!identity.sessionId)fail("unauthorized",401);
  if(!/^user_[A-Za-z0-9]{1,128}$/.test(actor)||actor!==process.env.GENIE_UNLIMITED_USER_ID?.trim())fail("unauthorized",403);
  if(request.headers.get("X-CineGenius-Genie-Account")!==actor)fail("unauthorized",409);
  if(request.headers.get("X-CineGenius-Genie-Contract")!==NATIVE_GENIE_CONTRACT)fail("invalid_request",400);
  if(process.env.GENIE_NATIVE_TEST_ENABLED?.trim().toLowerCase()!=="true")fail("unavailable");
  const config=genieConfiguration(actor);
  if(!config.personalQuality)fail("unauthorized",403);
  const verify=async()=>{
   request.signal.throwIfAborted();
   if(actor!==process.env.GENIE_UNLIMITED_USER_ID?.trim()||process.env.GENIE_NATIVE_TEST_ENABLED?.trim().toLowerCase()!=="true"||process.env.GENIE_ENABLED?.trim().toLowerCase()==="false")fail("unauthorized",403);
   const state=await verifyNativePushSession(actor!,identity.sessionId!);
   if(state!=="active")fail(state==="revoked"?"unauthorized":"unavailable",state==="revoked"?401:503);
  };
  await verify();
  if(inFlight.has(actor))fail("analysis_busy",409);
  const claimedActor=actor,claim=Symbol();
  // Vercel cancellation can end an invocation before async cleanup finishes.
  // Release synchronously on abort; a late finally may release only its own claim.
  const release=()=>{
   request.signal.removeEventListener("abort",release);
   if(inFlight.get(claimedActor)===claim)inFlight.delete(claimedActor);
  };
  releaseClaim=release;inFlight.set(claimedActor,claim);
  request.signal.addEventListener("abort",release,{once:true});
  if(request.signal.aborted){release();request.signal.throwIfAborted();}
  phase="input";
  const input=await readInput(request);
  validateNativeGenieInput(kind,input);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(540_000)]);
  const digest=createHmac("sha256",config.apiKey).update("native-genie:"+actor).digest("hex");
  if(providerEngine?.digest!==digest)providerEngine={digest,engine:createNativeGenieEngine(config.apiKey)};
  const engine=providerEngine.engine;
  let reserved=false;
  phase="analysis";
  const result=await engine(kind,input,{signal,beforeProvider:async()=>{
   signal.throwIfAborted();
   // Reserve before generation. Failed/aborted calls do not refund usage. The
   // common Genie guards are shared with chat/writing; no daily or total cap.
   if(reserved)fail("analysis_busy",409);reserved=true;
   await verify();
   if(!(await rateLimit("native-genie:minute:"+digest,2,60)).allowed)fail("rate_limited",429);
   await reserveGenieUsage(request,actor,config);
   signal.throwIfAborted();
  }});
  phase="recheck";signal.throwIfAborted();await verify();
  phase="response";
  const output=JSON.stringify(result);
  if(!object(result)||Buffer.byteLength(output)>MAX_BYTES)fail("too_large",502);
  return json(result);
 }catch(error){
  if(request.signal.aborted)return json({error:"cancelled"},499);
  if(error instanceof NativeGenieError)return json({error:error.code},error.status);
  const engineError=nativeGenieEngineError(error);
  if(engineError&&/^[a-z_]{1,80}$/.test(engineError.code)&&Number.isInteger(engineError.status)&&engineError.status>=400&&engineError.status<=599)return json({error:engineError.code},engineError.status,engineError);
  // The common quota/configuration errors contain only a closed code/status.
  if(object(error)&&["rate_limited","unavailable"].includes(String(error.code))&&[429,503].includes(Number(error.status)))return json({error:error.code},Number(error.status));
  return json({error:"unavailable"},503);
 }finally{releaseClaim?.();}
}
