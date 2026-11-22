import {NextRequest,NextResponse} from 'next/server';
import {rateLimit} from '@/lib/rateLimit';
import {WORK_MAIL_HEADERS,WorkMailError,workMailFilename,workMailUuid} from '@/lib/work-mail';
import {workMailCaller,workMailFailure} from '@/lib/work-mail-route';
import {workMailFile} from '@/lib/work-mail-service';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 try {
  const actor=await workMailCaller(request);if(actor instanceof NextResponse)return actor;
  const {id}=await params,attachment=request.nextUrl.searchParams.get('attachment');
  if(!workMailUuid(id)||attachment&&!/^[a-f0-9]{64}$/.test(attachment))throw new WorkMailError('invalid',400);
  if(!(await rateLimit(`work-mail-download:${actor.userId}`,30,60)).allowed)throw new WorkMailError('busy',429);
  const file=await workMailFile(actor.userId,id,attachment??undefined),name=workMailFilename(file.name);
  // Keep large private originals on the streaming response path; no signed/public redirect.
  const bytes=new Uint8Array(file.bytes);let offset=0;
  const stream=new ReadableStream<Uint8Array>({pull(controller){if(offset>=bytes.byteLength){controller.close();return;}const end=Math.min(offset+65536,bytes.byteLength);controller.enqueue(bytes.subarray(offset,end));offset=end;}});
  return new NextResponse(stream,{headers:{...WORK_MAIL_HEADERS,'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${name.replace(/[^\x20-\x7e]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`,'Content-Length':String(file.bytes.length),'X-Content-SHA256':file.sha256,'Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(cause){return workMailFailure(cause);}
}
