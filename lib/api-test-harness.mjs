import * as verification from './verification.ts';
import * as adminPolicy from './admin-policy.ts';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import vm from 'node:vm';
export const LOCALES=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
export const PRIVATE_DETAIL='PRIVATE member@example.test payload <private-data> database relation secret_table';
export function createApiHarness(options={}){
 const root=resolve(process.cwd()),require=createRequire(join(root,'package.json')),ts=require('typescript'),{createTranslator}=require('next-intl');
 const messages=JSON.parse(readFileSync(join(root,`messages/${options.locale??'en'}.json`),'utf8')),state={queries:[],rpcs:[],mails:[],logs:[],authCalls:0,network:0,fetchCalls:[],audits:[]};
 const translate=namespace=>createTranslator({locale:options.locale??'en',messages,namespace,onError(error){throw error;}});
 class NextResponse extends Response{static json(body,init){return new NextResponse(JSON.stringify(body),{...init,headers:{'Content-Type':'application/json',...(init?.headers??{})}});}}
 class SupportTargetError extends Error{constructor(message,status=404){super(message);this.status=status;}}
 const databaseError=options.databaseError??null;
 const booking={id:'booking-own',ref:'CG-Original<&東京',user_id:'booker-user',listing_id:'listing-own',listing_title:'Original München & <b>title</b>',status:'pending',...options.booking};
 const db={from(table){const call={table,operations:[]};state.queries.push(call);const query={};for(const op of['select','eq','is','neq','order','limit','update','insert','upsert','in','range'])query[op]=(...args)=>{call.operations.push({op,args:structuredClone(args)});return query;};const result=()=>{if(options.result)return options.result(table,call.operations);if(databaseError)return{data:null,error:databaseError};const data=table==='conversations'?{kind:'group'}:table==='conversation_members'?(options.missingMembership?null:{role:options.memberRole??'admin'}):table==='bookings'?booking:table==='listings'?{user_id:options.listingOwner??'owner-user',title:'Original listing'}:table==='profiles'?{user_id:'owner-user',display_name:'Owner private name',bio:'Original'}:null;return{data,error:null};};query.maybeSingle=async()=>result();query.single=async()=>result();query.then=(accept,reject)=>Promise.resolve(result()).then(accept,reject);return query;},async rpc(name,args){state.rpcs.push({name,args:structuredClone(args)});return{data:options.rpcResult?options.rpcResult(name,args):'created-group',error:options.rpcError??null};}};
 const auth=async()=>{state.authCalls++;if(options.authThrow)throw new Error(PRIVATE_DETAIL);if(options.denied)return NextResponse.json({error:'Controlled access denial'},{status:options.denied});return{userId:'owner-user'};};
 const mocks={
  'next/server':{NextRequest:Request,NextResponse},'next-intl/server':{getTranslations:async input=>translate(typeof input==='string'?input:input?.namespace)},'@/lib/db':{db},'@/lib/verification':verification,'@/lib/admin-policy':adminPolicy,'@/lib/auth':{requireAuth:auth,requireAdmin:auth,isAdminSession:async()=>Boolean(options.isAdmin)},'@/lib/requireAdmin':{requireAdmin:auth},
  '@/lib/guards':{requireAuth:auth,assertOwner(owner,actor,t){return owner==null?NextResponse.json({error:t('System.m_621ca4c037d3')},{status:404}):owner!==actor?NextResponse.json({error:t('System.m_cd2f7b0a21cd')},{status:403}):null;}},
  '@/lib/trust':{getPrivateProfileIds:async()=>new Set(options.privateIds??[]),anyBlockExists:async()=>false,areAcceptedFriends:async()=>true},'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},'@/lib/conversation-logic':{normalizeMemberIds:(actor,values)=>Array.isArray(values)?[...new Set(values.filter(v=>typeof v==='string'&&v!==actor))]:null},
  '@/lib/places/catalog':{placeWriteFields:()=>({})},'@/lib/places/core':{PLACE_COLUMNS:'place_city_id,place_status'},'@/lib/crew-occupations':{crewOccupationsError:()=>null},'@/lib/primary-occupation':{primaryOccupationError:()=>null},'@/lib/profile-types':{PROFILE_TYPE_LABELS:{filmmaker:'Filmmaker'},PROFILE_CATEGORY_MAP:{filmmaker:'filmmaker'}},'@/lib/profile-display':{normalizeProfileTypes:values=>values},'@/lib/profile-cover':{validProfileFocalPoint:()=>true},
  '@/lib/profile-db-compat':{retryWithoutMissingOptionalProfileColumns:async(payload,columns,writer)=>({...await writer(payload),unavailableFields:[]}),selectOptionalProfileColumns:async()=>({data:null,error:null,unavailableFields:[]})},'next/cache':{revalidateTag:()=>{}},
  '@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async()=>({id:'booker-user',locale:'sv',emailAddresses:[{emailAddress:'recipient@example.test'}]})}})},
  '@/lib/email':{sendBookingAcceptedEmail:async(...args)=>state.mails.push({fn:'sendBookingAcceptedEmail',args}),sendNewBookingEmail:async()=>{throw new Error('Wrong incoming-request email used for confirmation');}},
  '@/lib/i18n/notification-copy':{localizedNotification:fields=>({title:'Canonical generated title',body:'Canonical generated body',localization:{version:1,...fields}})},
  '@/lib/admin-support':{SupportTargetError,validateSupportTemplateBody:()=>null,resolveAdminSupportTarget:async()=>{if(options.supportError==='known')throw new SupportTargetError(translate()('ServerCopy.s_8dfbfdb29b9c'),409);if(options.supportError)throw new Error(PRIVATE_DETAIL);return{recipientUserId:'booker-user'};}},
 };
 mocks['@/lib/protected-media']={protectedMediaKey:()=>null,PROTECTED_MEDIA_BUCKET:'protected-media'};
 mocks['@/lib/protected-media-server']={readableProtectedMedia:async()=>false};
 mocks['@/lib/admin-audit']={validateAdminReason:()=> 'Controlled reason',startAdminAudit:async data=>{state.audits.push(data);return 'audit-own';},finishAdminAudit:async(id,outcome)=>{state.audits.push({id,outcome});return true;}};
 mocks['@/lib/support-setup-template']={SETUP_TEMPLATE_KEY:'setup',setupSupportTemplate:()=>({})};
 mocks['@/lib/support-started-offer-template']={STARTED_OFFER_TEMPLATE_KEY:'started',startedOfferTemplate:()=>({})};
 mocks['@/lib/support-identity']={SUPPORT_ACTOR_ID:'support',SUPPORT_AVATAR_URL:'/support.png',SUPPORT_NAME:'CineGenius'};
 mocks['@/lib/message-read-state']={applyParticipantReadReceipts:rows=>rows};
 const allowed=new Set(['app/api/admin/users/route.ts','app/api/admin/media/check/route.ts','app/api/admin/support/templates/route.ts','app/api/conversations/[id]/route.ts','app/api/verification-requests/route.ts','lib/conversation-rpc-errors.ts','app/api/bookings/[id]/route.ts','app/api/conversations/[id]/members/route.ts','app/api/conversations/groups/route.ts','app/api/profile/modules/route.ts','app/api/profile/physical/route.ts','app/api/profile/route.ts','app/api/admin/support/resolve/route.ts']),cache=new Map();
 const context=vm.createContext({Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,AbortSignal,process:Object.freeze({env:Object.freeze({NEXT_PUBLIC_SUPABASE_URL:'https://storage.example.test'})}),console:{error:(...args)=>state.logs.push(args)},fetch:async(url,init)=>{state.fetchCalls.push({url:String(url),method:init?.method,redirect:init?.redirect,cache:init?.cache});throw new Error('Controlled HEAD timeout; no network transport');}});
 function load(relative){if(!allowed.has(relative))throw new Error('Unexpected dependency '+relative);if(cache.has(relative))return cache.get(relative).exports;const mod={exports:{}},filename=join(root,relative);cache.set(relative,mod);const compiled=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const loader=id=>{if(Object.hasOwn(mocks,id))return mocks[id];if(id==='@/lib/conversation-rpc-errors')return load('lib/conversation-rpc-errors.ts');throw new Error('Unexpected dependency '+id);};new vm.Script('(function(require,module,exports){'+compiled+'\n})',{filename}).runInContext(context)(loader,mod,mod.exports);return mod.exports;}
 const request=body=>({json:async()=>body,nextUrl:new URL('https://example.test/api/admin/support/resolve?type=profile&id=own')});
 return{load,state,t:translate(),request,booking,NextResponse};
}
