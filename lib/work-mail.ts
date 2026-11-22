import {createHash,randomBytes} from 'node:crypto';

export const WORK_MAIL_LIMITS=Object.freeze({rawBytes:12*1024*1024,attachmentBytes:12*1024*1024,jsonBytes:2*1024*1024,webhookBytes:64*1024,items:200,totalBytes:100*1024*1024,attachments:20});
export const WORK_MAIL_HEADERS={'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export type WorkMailProvider='gmail'|'microsoft';
export type WorkMailAttachment={id:string;name:string;type:string;size:number;sha256?:string;cached?:boolean};
export type WorkMailSummary={id:string;subject:string;from:string;receivedAt:string;hasAttachments:boolean};
export type WorkMailSource={raw:Buffer;text:string|null;subject:string;from:string;receivedAt:string;attachments:WorkMailAttachment[]};
export class WorkMailError extends Error { readonly code:string;readonly status:number;constructor(code='unavailable',status=503){super(code);this.code=code;this.status=status;} }
export const workMailUuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const workMailAccount=(value:unknown):value is string=>typeof value==='string'&&/^user_[A-Za-z0-9]{1,128}$/.test(value);
export const workMailHash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
export const workMailAlias=()=>`cg-${randomBytes(24).toString('hex')}`;
export function workMailDomain(env:NodeJS.ProcessEnv=process.env):string|null {
 const value=env.WORK_MAIL_RECEIVING_DOMAIN?.trim().toLowerCase();
 // Receiving on the existing apex or www would redirect existing mail. A dedicated subdomain is mandatory.
 return value&&/^(?!www\.)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cinegenius\.co$/.test(value)?value:null;
}
export function workMailOrigin(env:NodeJS.ProcessEnv=process.env):string {
 const value=env.WORK_MAIL_PUBLIC_ORIGIN??'https://www.cinegenius.co';
 try{const url=new URL(value);if(url.protocol==='https:'&&['cinegenius.co','www.cinegenius.co'].includes(url.hostname)&&!url.port&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash)return url.origin;}catch{}
 throw new WorkMailError('unavailable');
}
export function workMailSameOrigin(request:Request,env:NodeJS.ProcessEnv=process.env):boolean {
 try{workMailOrigin(env);const origin=new URL(request.url).origin;return ['https://cinegenius.co','https://www.cinegenius.co'].includes(origin)&&request.headers.get('origin')===origin&&(!request.headers.get('sec-fetch-site')||request.headers.get('sec-fetch-site')==='same-origin');}catch{return false;}
}
export async function workMailReadBounded(response:Response,max:number):Promise<Buffer> {
 const length=response.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>max)){await response.body?.cancel();throw new WorkMailError('tooLarge',413);}
 if(!response.body)throw new WorkMailError('invalid',400);
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max)throw new WorkMailError('tooLarge',413);chunks.push(value);}return Buffer.concat(chunks,total);}finally{await reader.cancel().catch(()=>{});}
}
export async function workMailRequestJSON(request:Request,max=16_384):Promise<Record<string,unknown>> {
 const body=await workMailReadBounded(new Response(request.body,{headers:request.headers}),max);
 let value:unknown;try{value=JSON.parse(body.toString('utf8'));}catch{throw new WorkMailError('invalid',400);}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new WorkMailError('invalid',400);return value as Record<string,unknown>;
}
export function workMailText(value:unknown,limit:number):string { return typeof value==='string'?value.replace(/\u0000/g,'').slice(0,limit):''; }
export function workMailFilename(value:string,fallback='original.eml'):string {
 const clean=value.normalize('NFKC').replace(/[\u0000-\u001f\u007f"\\/<>:|?*]/g,'_').trim().slice(0,120);
 return clean&&clean!=='.'&&clean!=='..'?clean:fallback;
}
export function workMailAttachmentId(id:string):string {return workMailHash(id);}
export function workMailAttachmentList(value:unknown):WorkMailAttachment[] {
 if(!Array.isArray(value)||value.length>WORK_MAIL_LIMITS.attachments)throw new WorkMailError('tooLarge',413);
 return value.map(row=>{if(!row||typeof row!=='object')throw new WorkMailError('invalid',400);const a=row as Record<string,unknown>;
 if(typeof a.id!=='string'||a.id.length<1||a.id.length>2048||/[\u0000-\u001f]/.test(a.id)||!Number.isSafeInteger(a.size)||Number(a.size)<0||Number(a.size)>WORK_MAIL_LIMITS.attachmentBytes)throw new WorkMailError('tooLarge',413);
 return {id:a.id,name:workMailFilename(workMailText(a.name??a.filename,200),'attachment'),type:workMailText(a.type??a.content_type,120)||'application/octet-stream',size:Number(a.size)};});
}
