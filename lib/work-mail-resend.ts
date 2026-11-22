import {WorkMailError,WORK_MAIL_LIMITS,workMailAttachmentList,workMailReadBounded,workMailText,workMailUuid,type WorkMailSource} from './work-mail';
type Fetch=typeof fetch;
async function providerJSON(path:string,key:string,fetcher:Fetch):Promise<Record<string,unknown>> {
 const response=await fetcher('https://api.resend.com'+path,{headers:{Authorization:`Bearer ${key}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new WorkMailError('providerUnavailable',502);
 const bytes=await workMailReadBounded(response,WORK_MAIL_LIMITS.jsonBytes);
 try{const value=JSON.parse(bytes.toString('utf8'));if(value&&typeof value==='object'&&!Array.isArray(value))return value;}catch{}throw new WorkMailError('providerUnavailable',502);
}
async function providerFile(value:unknown,fetcher:Fetch,max:number):Promise<Buffer> {
 if(typeof value!=='string')throw new WorkMailError('providerUnavailable',502);
 let url:URL;try{url=new URL(value);}catch{throw new WorkMailError('providerUnavailable',502);}
 // Only a fresh URL returned by the fixed Receiving API is accepted; redirects and arbitrary hosts are forbidden.
 if(url.protocol!=='https:'||url.hostname!=='inbound-cdn.resend.com'||url.port||url.username||url.password||url.hash)throw new WorkMailError('providerUnavailable',502);
 const response=await fetcher(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new WorkMailError('providerUnavailable',502);return workMailReadBounded(response,max);
}
export async function getWorkMailResendRaw(emailId:string,key:string,fetcher:Fetch=fetch,expectedRecipient?:string):Promise<WorkMailSource> {
 if(!workMailUuid(emailId)||!key)throw new WorkMailError('invalid',400);
 const value=await providerJSON(`/emails/receiving/${emailId}?html_format=cid`,key,fetcher);
 if(value.id!==emailId||!value.raw||typeof value.raw!=='object')throw new WorkMailError('providerUnavailable',502);
 if(expectedRecipient&&(!Array.isArray(value.to)||!value.to.some(address=>typeof address==='string'&&address.toLowerCase()===expectedRecipient.toLowerCase())))throw new WorkMailError('providerUnavailable',502);
 if(typeof value.created_at!=='string'||Number.isNaN(Date.parse(value.created_at)))throw new WorkMailError('providerUnavailable',502);
 const attachments=workMailAttachmentList(value.attachments??[]);
 const raw=await providerFile((value.raw as Record<string,unknown>).download_url,fetcher,WORK_MAIL_LIMITS.rawBytes);
 if(!raw.length)throw new WorkMailError('invalid',400);
 return {raw,text:typeof value.text==='string'?workMailText(value.text,200_000):null,subject:workMailText(value.subject,500),from:workMailText(value.from,500),receivedAt:new Date(value.created_at).toISOString(),attachments};
}
export async function getWorkMailResendAttachment(emailId:string,attachmentId:string,key:string,fetcher:Fetch=fetch) {
 if(!workMailUuid(emailId)||!workMailUuid(attachmentId)||!key)throw new WorkMailError('invalid',400);
 const value=await providerJSON(`/emails/receiving/${emailId}/attachments/${attachmentId}`,key,fetcher);
 if(value.id!==attachmentId||!Number.isSafeInteger(value.size)||Number(value.size)>WORK_MAIL_LIMITS.attachmentBytes)throw new WorkMailError('providerUnavailable',502);
 const bytes=await providerFile(value.download_url,fetcher,WORK_MAIL_LIMITS.attachmentBytes);
 if(bytes.length!==value.size)throw new WorkMailError('providerUnavailable',502);
 return {bytes,name:workMailText(value.filename,200),type:workMailText(value.content_type,120),size:bytes.length};
}
