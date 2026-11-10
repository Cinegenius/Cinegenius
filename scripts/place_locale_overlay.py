"""Deterministic, offline GeoNames NL/nl-BE/SV additions. No joins by names."""
from pathlib import Path
from datetime import date
from collections import Counter, defaultdict
import argparse, copy, hashlib, json, re, zipfile
LOCALES=('nl','nl-BE','sv')
KINDS=('cities','regions','districts')
def sha256_file(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for part in iter(lambda:f.read(1024*1024),b''):h.update(part)
 return h.hexdigest()
def canonical_locale(value):return {'nl':'nl','nl-be':'nl-BE','sv':'sv'}.get(value.lower().replace('_','-'))
def current_from(value,as_of):
 if not value:return True
 if not re.fullmatch(r'\d{4}(?:-\d{2}(?:-\d{2})?)?',value):return False
 parts=[int(x) for x in value.split('-')]
 try:return date(parts[0],parts[1] if len(parts)>1 else 1,parts[2] if len(parts)>2 else 1)<=as_of
 except ValueError:return False
class CurrentNameCollector:
 def __init__(self,ids,as_of):
  self.ids=set(ids);self.as_of=date.fromisoformat(as_of);self.candidates=defaultdict(list);self.counts=Counter();self.rejected=[]
 def consider(self,r):
  if len(r)<3 or r[1] not in self.ids:return
  if r[2].lower()=='vls':self.counts['excluded_vls']+=1;return
  locale=canonical_locale(r[2])
  if not locale:return
  self.counts['relevant_'+locale]+=1;reason=None
  if len(r)!=10:reason='malformed_v2'
  elif not r[0].isdigit() or not r[3] or r[3]!=r[3].strip() or any(ord(c)<32 or ord(c)==127 for c in r[3]):reason='invalid_name_or_source_id'
  elif any(flag not in ('','0','1') for flag in r[4:8]):reason='unknown_flags'
  elif r[5]=='1':reason='short'
  elif r[6]=='1':reason='colloquial'
  elif r[7]=='1':reason='historic'
  elif r[9]:reason='ended_period'
  elif not current_from(r[8],self.as_of):reason='future_or_unclear_start'
  if reason:
   self.counts['excluded_'+reason]+=1;self.rejected.append({'geonameId':r[1],'locale':locale,'alternateNameId':r[0],'name':r[3] if len(r)>3 else '', 'reason':reason});return
  self.candidates[(r[1],locale)].append({'name':r[3],'preferred':r[4]=='1','alternateNameId':r[0],'from':r[8]})
 def finish(self):
  selected={};provenance={};ambiguous=[]
  for (geoid,locale),rows in sorted(self.candidates.items()):
   preferred=[r for r in rows if r['preferred']];candidates=preferred or rows;names=sorted({r['name'] for r in candidates})
   if len(names)!=1:
    ambiguous.append({'geonameId':geoid,'locale':locale,'preferred':bool(preferred),'names':names,'alternateNameIds':sorted({r['alternateNameId'] for r in candidates},key=int)});continue
   row=min((r for r in candidates if r['name']==names[0]),key=lambda r:int(r['alternateNameId']))
   selected[(geoid,locale)]=row['name'];provenance[(geoid,locale)]={'geonameId':geoid,'locale':locale,'name':row['name'],'alternateNameId':row['alternateNameId'],'basis':'preferred_current' if preferred else 'unique_current','from':row['from']}
  for geoid in sorted(self.ids):
   if (geoid,'nl-BE') not in selected and (geoid,'nl') in selected:
    selected[(geoid,'nl-BE')]=selected[(geoid,'nl')];provenance[(geoid,'nl-BE')]={**provenance[(geoid,'nl')],'locale':'nl-BE','basis':'native_nl_fallback','sourceLocale':'nl'}
  return selected,{'counts':dict(sorted(self.counts.items())),'ambiguous':ambiguous,'rejected':self.rejected,'provenance':[provenance[k] for k in sorted(provenance)]}
def collect_zip(path,ids,as_of):
 collector=CurrentNameCollector(ids,as_of);total=0
 with zipfile.ZipFile(path) as archive:
  if 'alternateNamesV2.txt' not in archive.namelist():raise ValueError('Expected official V2 member including date fields')
  with archive.open('alternateNamesV2.txt') as f:
   for line in f:
    total+=1;r=line.rstrip(b'\r\n').split(b'\t')
    if len(r)<3 or r[2].lower().replace(b'_',b'-') not in (b'nl',b'nl-be',b'sv',b'vls'):continue
    if r[1].decode('ascii') not in collector.ids:continue
    collector.consider([x.decode('utf-8') for x in r])
 selected,report=collector.finish();report['inputRowsStreamed']=total;return selected,report
def invariant_fingerprint(catalog,changes):
 value=copy.deepcopy(catalog)
 for kind in KINDS:
  for row in value[kind]:
   patch=changes.get(kind,{}).get(row['id'])
   if not patch:continue
   for locale in patch.get('names',{}):row['names'].pop(locale,None)
   if 'aliases' in row:row['aliases']=[name for name in row['aliases'] if name not in set(patch.get('aliases',[]))]
 return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def build_overlay(catalog,selected):
 changes={kind:{} for kind in KINDS};conflicts=[]
 for kind in KINDS:
  for row in catalog[kind]:
   names={};geoid=row['id'].split(':')[-1]
   for locale in LOCALES:
    name=selected.get((geoid,locale))
    if name is None:continue
    old=row['names'].get(locale)
    if old is not None and old!=name:conflicts.append({'kind':kind,'id':row['id'],'locale':locale,'existing':old,'candidate':name})
    else:names[locale]=name
   aliases=sorted(set(names.values())-set(row.get('aliases',[]))) if 'aliases' in row else []
   if any(locale not in row['names'] for locale in names) or aliases:changes[kind][row['id']]={'names':names,**({'aliases':aliases} if aliases else {})}
 overlay={'version':1,'baseCounts':{k:len(catalog[k]) for k in KINDS},'changes':changes};overlay['baseInvariantSha256']=invariant_fingerprint(catalog,changes);return overlay,conflicts
def apply_overlay(catalog,overlay):
 if overlay.get('version')!=1 or overlay['baseCounts']!={k:len(catalog[k]) for k in KINDS}:raise ValueError('Unexpected version/counts')
 if invariant_fingerprint(catalog,overlay['changes'])!=overlay['baseInvariantSha256']:raise ValueError('Catalog outside reviewed additions differs')
 result=copy.deepcopy(catalog)
 for kind in KINDS:
  index={r['id']:r for r in result[kind]}
  if len(index)!=len(result[kind]):raise ValueError('Duplicate catalog identity')
  for identifier,patch in overlay['changes'].get(kind,{}).items():
   if identifier not in index or set(patch)-{'names','aliases'}:raise ValueError('Unknown identity/patch field')
   row=index[identifier]
   for locale,name in patch.get('names',{}).items():
    if locale not in LOCALES or not isinstance(name,str) or not name:raise ValueError('Unexpected locale/name')
    if locale in row['names'] and row['names'][locale]!=name:raise ValueError('Existing name conflict')
    row['names'][locale]=name
   if patch.get('aliases'):
    if 'aliases' not in row or not all(n in patch['names'].values() for n in patch['aliases']):raise ValueError('Only selected current labels become new aliases')
    row['aliases'] += [n for n in patch['aliases'] if n not in row['aliases']]
 if invariant_fingerprint(result,overlay['changes'])!=overlay['baseInvariantSha256']:raise ValueError('Preservation check failed')
 return result
def main():
 parser=argparse.ArgumentParser(description=__doc__);sub=parser.add_subparsers(dest='command',required=True);build=sub.add_parser('build')
 for key in ['catalog','names-zip','manifest','as-of','output','report']:build.add_argument('--'+key,required=True)
 apply=sub.add_parser('apply')
 for key in ['catalog','overlay','output']:apply.add_argument('--'+key,required=True)
 args=parser.parse_args();catalog=json.loads(Path(args.catalog).read_text())
 if args.command=='build':
  manifest=json.loads(Path(args.manifest).read_text())
  if Path(args.names_zip).stat().st_size!=manifest['bytes'] or sha256_file(args.names_zip)!=manifest['sha256']:raise ValueError('Source archive differs from verified manifest')
  selected,report=collect_zip(args.names_zip,{r['id'].split(':')[-1] for k in KINDS for r in catalog[k]},args.as_of);overlay,conflicts=build_overlay(catalog,selected)
  overlay['source']={**manifest,'asOf':args.as_of,'baseCatalogSha256':sha256_file(args.catalog)};report['conflicts']=conflicts;report['coverage']={kind:{locale:sum(locale in p['names'] for p in overlay['changes'][kind].values()) for locale in LOCALES} for kind in KINDS}
  Path(args.output).write_text(json.dumps(overlay,ensure_ascii=False,separators=(',',':'))+'\n');Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'coverage':report['coverage'],'ambiguous':len(report['ambiguous']),'conflicts':len(conflicts),'counts':report['counts']}))
 else:
  result=apply_overlay(catalog,json.loads(Path(args.overlay).read_text()));Path(args.output).parent.mkdir(parents=True,exist_ok=True);Path(args.output).write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n');print(json.dumps({'counts':{k:len(result[k]) for k in KINDS},'preservation':'passed'}))
if __name__=='__main__':main()
