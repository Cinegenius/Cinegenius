import { isAppLocale } from "@/lib/i18n/locales";
import {getLocale} from "next-intl/server";
import {localizedPlaceFields} from "@/lib/places/catalog";
import {NextRequest,NextResponse} from 'next/server';
import {listingFacetRows} from '@/lib/marketplace-facets';
export async function GET(request:NextRequest){
 const scope=request.nextUrl.searchParams.get('scope');
 if(scope!=='marketplace'&&scope!=='locations')return NextResponse.json({rows:[]},{status:400});
 const locale=request.nextUrl.searchParams.get('locale')??await getLocale();
 if(!isAppLocale(locale))return NextResponse.json({rows:[]},{status:400});
 let rows;
 try { rows=await listingFacetRows(locale,scope==='locations'?['location']:['prop','vehicle']); } catch { return NextResponse.json({rows:[]},{status:503}); }
 return NextResponse.json({rows:rows.map(row=>localizedPlaceFields(Object.fromEntries(Object.entries(row).filter(([key])=>key.startsWith('place_'))),locale))},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Accept-Language'}});
}
