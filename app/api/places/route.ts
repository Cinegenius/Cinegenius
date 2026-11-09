import { NextRequest, NextResponse } from 'next/server';
import { aliases, placeCatalog, resolvePlace, cityDistrictName } from '@/lib/places/catalog';
import { cityName, placeKey } from '@/lib/places/core';
export async function GET(req: NextRequest) {
 const s=req.nextUrl.searchParams, country=s.get('country')??'', region=s.get('region')??'', q=placeKey((s.get('q')??'').slice(0,120)),locale=s.get('locale')??'de';
 if(!['de','en','es','it','cs','hu'].includes(locale))return NextResponse.json({error:'locale'},{status:400});
 if(s.has('resolve'))return NextResponse.json(resolvePlace((s.get('resolve')??'').slice(0,300)));
 const regions=placeCatalog.regions.filter(r=>r.country===country).map(r=>({id:r.id,name:r.names[locale]??r.name,aliases:[r.name,...r.aliases]})).sort((a,b)=>a.name.localeCompare(b.name,locale));
 const cities=q.length<2?[]:placeCatalog.cities.filter(c=>c.country===country&&(!region||c.region===region)&&[c.names[locale]??cityName(c.id,c.name,locale),...aliases(c)].some(a=>placeKey(a).includes(q))).map(c=>({id:c.id,name:c.names[locale]??cityName(c.id,c.name,locale),canonicalName:c.name,regionId:c.region,district:cityDistrictName(c,locale),region:regions.find(r=>r.id===c.region)?.name??''})).sort((a,b)=>a.name.localeCompare(b.name,locale)||a.district.localeCompare(b.district,locale)||a.id.localeCompare(b.id)).slice(0,30);
 return NextResponse.json({regions,cities},{headers:{'Cache-Control':'private, no-store'}});
}
