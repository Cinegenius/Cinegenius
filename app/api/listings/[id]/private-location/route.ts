import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { privateLocationInput, publicLocationArea } from '@/lib/location-privacy';
import { revalidatePath } from 'next/cache';
const response = (body: unknown, status=200) => NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store'}});
async function handle(req: Request, context: {params:Promise<{id:string}>}, write: boolean) {
 const t=await getTranslations('locationPrivacy');
 const auth=await requireAuth();if(auth instanceof NextResponse){auth.headers.set('Cache-Control','private, no-store');return auth;}
 const {id}=await context.params;
 if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))return response({error:t('unavailable')},404);
 let value: ReturnType<typeof privateLocationInput> = null;let revision=0;
 if(write){const body=await req.json().catch(()=>null);value=privateLocationInput(body?.value);revision=body?.revision;
  if(value===false||!Number.isSafeInteger(revision)||revision<0)return response({error:t('invalid')},400);
 }
 const {data,error}=await db.rpc('listing_private_location',{p_id:id,p_actor:auth.userId,p_write:write,p_value:value,p_area:value?publicLocationArea(value):null,p_revision:revision});
 if(error)return response({error:t('unavailable')},503);
 if(data?.status==='missing')return response({error:t('unavailable')},404);
 if(data?.status==='conflict')return response({error:t('conflict')},409);
 if(!['ok','saved'].includes(data?.status))return response({error:t('unavailable')},503);
 if(write){revalidatePath('/locations');revalidatePath('/locations/suche');revalidatePath(`/locations/${id}`);}
 return response(data);
}
export const GET=(req:Request,context:{params:Promise<{id:string}>})=>handle(req,context,false);
export const PATCH=(req:Request,context:{params:Promise<{id:string}>})=>handle(req,context,true);
