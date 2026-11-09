"""Build the pinned GeoNames subset. Inputs are local licensed export files.
Usage: python3 scripts/build-place-catalog.py /absolute/path/to/source
Expected files: countries.txt, regions.txt, districts.txt, cities.zip, names.zip.
Never download or change the catalogue during application requests.
"""
from pathlib import Path
import json,sys,zipfile,hashlib
source=Path(sys.argv[1]);target=Path(__file__).resolve().parent.parent/'lib/places'
locales={'de','en','es','it','cs','hu'}
country_rows=[l.split('\t') for l in (source/'countries.txt').read_text().splitlines() if l and not l.startswith('#')]
# Retired codes stay unresolved legacy text; never invent a successor country.
countries=sorted({r[0] for r in country_rows}-{'AN','CS','YU'})
regions=[];by_id={}
for line in (source/'regions.txt').read_text().splitlines():
 r=line.split('\t')
 if len(r)!=4 or r[0].split('.')[0] not in countries:continue
 region=dict(id=r[0].split('.')[0]+':geonames:'+r[3],code=r[0],name=r[1],aliases=sorted(set([r[1],r[2]])),country=r[0].split('.')[0],names={})
 regions.append(region);by_id[r[3]]=region
region_ids={r['code']:r['id'] for r in regions}
districts=[];district_ids={}
for line in (source/'districts.txt').read_text().splitlines():
 r=line.split('\t')
 if len(r)!=4 or r[0].split('.')[0] not in countries:continue
 district=dict(id='geonames:'+r[3],name=r[1],names={})
 districts.append(district);district_ids[r[0]]=district['id']
cities=[]
with zipfile.ZipFile(source/'cities.zip') as z:
 for line in z.open('cities15000.txt'):
  r=line.decode().rstrip('\n').split('\t')
  # PPLX denotes a section of another populated place, not a municipality.
  if r[6]!='P' or r[7] in {'PPLX','PPLH','PPLQ','PPLW'} or r[8] not in countries:continue
  city=dict(id='geonames:'+r[0],name=r[1],country=r[8],region=region_ids.get(r[8]+'.'+r[10],''),district=district_ids.get('.'.join([r[8],r[10],r[11]]),''),aliases=sorted(set([r[2]]+r[3].split(','))-{''}),names={})
  cities.append(city);by_id[r[0]]=city
used_districts={c['district'] for c in cities}
districts=[d for d in districts if d['id'] in used_districts]
for district in districts:by_id[district['id'].split(':')[1]]=district
rankings={}
with zipfile.ZipFile(source/'names.zip') as z:
 name=next(n for n in z.namelist() if n.endswith('alternateNamesV2.txt'))
 for line in z.open(name):
  r=line.decode().rstrip('\n').split('\t')
  if len(r)<8 or r[1] not in by_id or r[2] not in locales or r[6]=='1' or r[7]=='1':continue
  if len(r)>9 and r[9]:continue
  key=(r[1],r[2]);rank=(r[4]=='1',r[5]=='1',-len(r[3]))
  if key not in rankings or rank>rankings[key]:
   rankings[key]=rank;by_id[r[1]]['names'][r[2]]=r[3]
for place in by_id.values():
 if 'aliases' in place:place['aliases']=sorted(set(place['aliases']+list(place['names'].values())))
# Reviewed display overrides for common equivalents, without changing identity.
for place in cities:
 if place['id']=='geonames:2925533':place['aliases']=sorted(set(place['aliases']+['Frankfurt a.M.','Frankfurt a. M.','Frankfurt/Main']))
 if place['id']=='geonames:2886242':place['names']['de']='Köln'
regions.sort(key=lambda x:x['id']);cities.sort(key=lambda x:int(x['id'].split(':')[1]))
districts.sort(key=lambda x:x['id'])
data=dict(countries=countries,regions=regions,districts=districts,cities=cities)
(target/'catalog.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
(target/'countries.ts').write_text('export const COUNTRY_CODES = '+json.dumps(countries)+' as const;\n')
def hash_file(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
metadata={"source":"https://download.geonames.org/export/dump/","license":"https://creativecommons.org/licenses/by/4.0/","snapshot":"2026-11-09","countries":len(countries),"regions":len(regions),"districts":len(districts),"cities":len(cities),"inputSha256":{name:hash_file(source/name) for name in ['countries.txt','regions.txt','districts.txt','cities.zip','names.zip']}}
(target/'source.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps({k:v for k,v in metadata.items() if k!='inputSha256'}))
