import { isAppLocale } from "@/lib/i18n/locales";
import {getLocale} from "next-intl/server";
import {localizedPlaceFields} from "@/lib/places/catalog";
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
export async function GET(request:NextRequest){
 const scope=request.nextUrl.searchParams.get('scope');
 if(scope!=='marketplace'&&scope!=='locations')return NextResponse.json({rows:[]},{status:400});
 const locale=request.nextUrl.searchParams.get('locale')??await getLocale();
 if(!isAppLocale(locale))return NextResponse.json({rows:[]},{status:400});
 const result=await db.rpc('public_place_options',{p_scope:scope});
 if(result.error)return NextResponse.json({rows:[]},{status:503});
 return NextResponse.json({rows:(result.data??[]).map((row:Record<string,unknown>)=>localizedPlaceFields(row,locale))},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Accept-Language'}});
}
