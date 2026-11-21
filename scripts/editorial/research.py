#!/usr/bin/env python3
"""Private, research-only CineGenius worker. Never authenticates to the product."""
import argparse, datetime as dt, hashlib, ipaddress, json, os, re, signal
import subprocess, sys, tempfile, time, unicodedata, resource, math
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from source_conflicts import CONFLICT_SCHEMA, RESEARCH_CONFLICT_POLICY, conflicts

ROOT = Path(__file__).resolve().parents[1]
UTC = dt.timezone.utc

def now(): return dt.datetime.now(UTC).replace(microsecond=0).isoformat()
def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.chmod(0o600); tmp.replace(path)

def clean_log(text):
    text = re.sub(r'(?i)(bearer\s+|api[_ -]?key[=: ]+|token[=: ]+)[A-Za-z0-9._/+\-=]{12,}', r'\1[REDACTED]', text)
    text = re.sub(r'\bsk-[A-Za-z0-9_-]{10,}', '[REDACTED]', text)
    text = re.sub(r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[REDACTED]', text)
    return text[-120000:]

def canonical(url):
    p = urlsplit(url)
    if p.scheme != 'https' or not p.hostname or p.username or p.password: raise ValueError('Non-public HTTPS URL')
    host = p.hostname.lower()
    if host=='localhost' or 'vogue' in host or host.endswith(('.local','.internal')) or p.port not in (None,443): raise ValueError('Blocked source or private host/port')
    try:
        if not ipaddress.ip_address(host).is_global: raise ValueError('Private IP')
    except ValueError as e:
        if str(e) == 'Private IP': raise
    query=[]
    for k,v in parse_qsl(p.query,keep_blank_values=True):
        if re.search(r'(?i)token|secret|password|activation|unsubscribe|session|email',k): raise ValueError('Personal or credential URL')
        if not k.lower().startswith('utm_') and k.lower() not in ('fbclid','gclid'): query.append((k,v))
    return urlunsplit(('https',host,p.path.rstrip('/') or '/',urlencode(query),''))

def titlekey(t): return re.sub(r'[^\w]+','',unicodedata.normalize('NFKC',t).casefold())
def domain_allowed(url, group):
    h=urlsplit(canonical(url)).hostname
    return any(h==d or h.endswith('.'+d) for d in group['allowedDomains'])

def allowed_or_false(url,group):
    try:return domain_allowed(url,group)
    except (ValueError,TypeError,AttributeError):return False

def audience_priorities(ids):
    balanced={'mode':'balanced','status':'awaiting_verified_aggregate_feed','groupWeights':{i:1.0 for i in ids},'countryWeights':{},'craftWeights':{},'languageWeights':{},'genderUsedForRanking':False,'rawMemberDataIncluded':False}
    try:
        a=json.loads((ROOT/'context/audience-priorities.json').read_text())
        allowed={'schemaVersion','status','generatedAt','validUntil','mode','groupWeights','countryWeights','craftWeights','languageWeights','genderUsedForRanking','rawMemberDataIncluded'}
        if set(a)!=allowed or a['schemaVersion']!=1 or a['status']!='ready' or a['mode']!='aggregate_editorial_priorities' or a['genderUsedForRanking'] is not False or a['rawMemberDataIncluded'] is not False:return balanced
        generated=dt.datetime.fromisoformat(a['generatedAt'].replace('Z','+00:00'))
        age=(dt.datetime.now(UTC)-generated).total_seconds()
        if age < -300 or age>7*86400:return {**balanced,'status':'stale_aggregate_feed'}
        if a['validUntil'] and dt.datetime.fromisoformat(a['validUntil'].replace('Z','+00:00'))<=dt.datetime.now(UTC):return {**balanced,'status':'stale_aggregate_feed'}
        patterns={'groupWeights':None,'countryWeights':r'[A-Z]{2}','craftWeights':r'[a-z][a-z0-9_-]{0,79}','languageWeights':r'[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*'}
        for field,pattern in patterns.items():
            if not isinstance(a[field],dict) or len(a[field])>300:raise ValueError('invalid weights')
            for key,value in a[field].items():
                if (field=='groupWeights' and key not in ids) or (pattern and not re.fullmatch(pattern,key)):raise ValueError('invalid group/key')
                if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not 1.0<=value<=2.0:raise ValueError('invalid weight')
        a['groupWeights']={i:a['groupWeights'].get(i,1.0) for i in ids}
        return a
    except FileNotFoundError:return balanced
    except (OSError,ValueError,TypeError,KeyError,AttributeError):return {**balanced,'status':'invalid_aggregate_feed'}

def validate(data, groups):
    if not isinstance(data,dict) or set(data) != {'checks','drafts','expiryCandidates','notes'}: raise ValueError('Invalid result structure')
    selected={g['id']:g for g in groups}; seen=set(); quarantined=set()
    if len(data['checks'])!=len(groups) or len(data['drafts'])>6 or len(data['expiryCandidates'])>12: raise ValueError('Result bounds')
    for c in data['checks']:
        if c['groupId'] not in selected or c['groupId'] in seen or c['status'] not in ('checked','error','not_checked'): raise ValueError('Invalid source check')
        seen.add(c['groupId'])
        if c['status']=='checked' and not c['checkedUrls']:
            c['status']='error';c['note']='No verifiable checked source URL; '+c['note'][:900]
        if any(not allowed_or_false(u,selected[c['groupId']]) for u in c['checkedUrls']):
            quarantined.add(c['groupId'])
            c['checkedUrls']=[u for u in c['checkedUrls'] if allowed_or_false(u,selected[c['groupId']])]
            c['status']='error';c['note']=('Unapproved checked source quarantined; no successful cursor advance. '+c['note'])[:1000]
    accepted=[]
    for d in data['drafts']:
        if d['groupId'] not in selected: raise ValueError('Unknown draft group')
        if d['groupId'] in quarantined: continue
        if not allowed_or_false(d['sourceUrl'],selected[d['groupId']]):
            quarantined.add(d['groupId'])
            data['notes'].append('A draft source outside the approved group domains was quarantined; no import performed.')
            for c in data['checks']:
                if c['groupId']==d['groupId']:c['status']='error';c['note']='Unapproved draft source quarantined. '+c['note'][:900]
            continue
        try:
            conflicts(d)
            if not (2<=len(d['title'])<=180 and 10<=len(d['summary'])<=500 and 40<=len(d['description'])<=10000): raise ValueError('Invalid text bounds')
            d['confirmationUrls']=[canonical(u) for u in d['confirmationUrls']]
            if len(d['countryCodes'])>12 or any(not re.fullmatch('[A-Z]{2}',c) for c in d['countryCodes']): raise ValueError('Invalid countries')
            for k in ('sourcePublishedOn','eventStart','eventEnd','deadline'):
                if d[k] is not None:dt.datetime.fromisoformat(d[k].replace('Z','+00:00'))
            if d['deadline'] and 'T' in d['deadline'] and not d['deadlineTimezone']: raise ValueError('Missing deadline timezone')
            check=next(c for c in data['checks'] if c['groupId']==d['groupId'])
            if canonical(d['sourceUrl']) not in [canonical(u) for u in check['checkedUrls']]: raise ValueError('Original detail URL missing from checked evidence')
        except (ValueError,TypeError,KeyError,AttributeError) as e:
            quarantined.add(d['groupId'])
            for c in data['checks']:
                if c['groupId']==d['groupId']:c['status']='error';c['note']=('Draft validation failed; group quarantined: '+str(e)+'. '+c['note'])[:1000]
            continue
        accepted.append(d)
    data['drafts']=[d for d in accepted if d['groupId'] not in quarantined]
    safeexpiry=[]
    for e in data['expiryCandidates']:
        try:
            e['sourceUrl']=canonical(e['sourceUrl']);e['evidenceUrl']=canonical(e['evidenceUrl']);safeexpiry.append(e)
        except (ValueError,TypeError,KeyError):pass
    data['expiryCandidates']=safeexpiry
    return data

def run(args):
    manifest=json.loads((ROOT/'config/sources.json').read_text())
    audience=audience_priorities({g['id'] for g in manifest['groups']})
    groups=[g for g in manifest['groups'] if not args.group or g['id']==args.group]
    if not groups: raise ValueError('Unknown group')
    if not args.group and not args.smoke:
        # Rotate source priority by UTC hour, avoiding permanent first-group bias.
        offset=int(dt.datetime.now(UTC).timestamp()//3600)%len(groups)
        groups=groups[offset:]+groups[:offset]
        seedhour=int(dt.datetime.now(UTC).timestamp()//3600)
        groups=[{**g,'urls':[g['urls'][seedhour%len(g['urls'])]],'configuredSourceCount':len(g['urls']),'allSourcesInGroupRequested':len(g['urls'])==1,'coverage':'rotating_source_subset'} for g in groups]
    if args.source_url:
        if len(groups)!=1 or not domain_allowed(args.source_url,groups[0]): raise ValueError('Single-source verification needs one allowed group')
        groups=[{**groups[0],'urls':[canonical(args.source_url)],'coverage':'single_source_verification'}]
    statefile=ROOT/'state/research-state.json'
    state=json.loads(statefile.read_text()) if statefile.exists() else {'schemaVersion':1,'mode':'research_only','groups':{},'knownDrafts':[],'runs':[]}
    stamp=dt.datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')
    rundir=ROOT/'runs'/stamp; rundir.mkdir(parents=True,exist_ok=False)
    # Version the conflict declaration in code, without rewriting the configured
    # source catalogue/schema or backfilling unreviewed legacy drafts.
    schema=rundir/'output-schema.json'
    output_schema=json.loads((ROOT/'config/output-schema.json').read_text())
    draft_schema=output_schema['properties']['drafts']['items']
    draft_schema['properties']['sourceConflicts']=CONFLICT_SCHEMA
    if 'sourceConflicts' not in draft_schema['required']:
        draft_schema['required'].append('sourceConflicts')
    atomic(schema,output_schema)
    source_window=[]
    for g in groups:
        last=state.get('sources',{}).get(canonical(g['urls'][0]),{}).get('lastSuccessfulAt')
        if not last and g.get('allSourcesInGroupRequested',True):last=state['groups'].get(g['id'],{}).get('lastSuccessfulAt')
        since=(dt.datetime.fromisoformat(last)-dt.timedelta(days=g['overlapDays'])).date().isoformat() if last else (dt.datetime.now(UTC)-dt.timedelta(days=7)).date().isoformat()
        source_window.append({**g,'since':since})
    dedup=json.loads((ROOT/'context/dedup.json').read_text())+state['knownDrafts']
    context={'nowUTC':now(),'groups':source_window,'knownItems':dedup,'audiencePriorities':audience,'limits':{'maxDrafts':1 if args.group else 6,'maxPages':3 if args.group else 26,'maxSeconds':min(args.timeout,600)},'mode':'research_only_no_product_access'}
    from feedback import research_context
    context['articleReadership']=research_context(ROOT,dt.datetime.now(UTC))
    (rundir/'input.json').write_text(json.dumps(context,ensure_ascii=False,indent=2))
    if args.smoke:
        prompt='Smoke test only. Do not use tools or network sources. Return exactly the required JSON structure: checks=[], drafts=[], expiryCandidates=[], notes=["CLI/schema smoke test only; no source check performed"]. Do not read any files.'
    else:
        prompt=(ROOT/'config/policy.md').read_text()+RESEARCH_CONFLICT_POLICY+'\n\nContext JSON:\n'+json.dumps(context,ensure_ascii=False)+'\n\nReturn only the schema-conforming JSON. Do not write files or use shell/tools except live web search/open for public original sources. Do not read filesystem paths. Do not access the CineGenius product, Gmail or credentials.'
    command=['/home/cinegenius/.local/bin/codex','--search','--disable','shell_tool','--disable','unified_exec','-a','never','exec','--ignore-user-config','--sandbox','workspace-write','--skip-git-repo-check','--ephemeral','--output-schema',str(schema),'--output-last-message',str(rundir/'result.raw.json'),'-C',str(rundir),prompt]
    env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','USER','LOGNAME','LANG','LC_ALL','SSL_CERT_FILE','SSL_CERT_DIR')}
    env.update(CODEX_HOME=str(ROOT/'codex-home'),CODEX_SQLITE_HOME=str(ROOT/'codex-state'),XDG_CACHE_HOME=str(ROOT/'cache'),TMPDIR=str(ROOT/'tmp'))
    started=now(); timedout=False
    with tempfile.TemporaryFile(dir=ROOT/'tmp') as log:
        proc=subprocess.Popen(command,env=env,stdout=log,stderr=log,start_new_session=True,preexec_fn=lambda:resource.setrlimit(resource.RLIMIT_FSIZE,(33554432,33554432)))
        try: code=proc.wait(timeout=min(args.timeout,600))
        except subprocess.TimeoutExpired:
            timedout=True; os.killpg(proc.pid,signal.SIGTERM)
            try: code=proc.wait(timeout=10)
            except subprocess.TimeoutExpired: os.killpg(proc.pid,signal.SIGKILL); code=proc.wait()
        log.seek(0,2); size=log.tell(); log.seek(max(0,size-240000)); text=clean_log(log.read().decode('utf-8','replace'))
    (rundir/'cli.log').write_text(text)
    receipt={'runId':stamp,'mode':'research_only','scope':'smoke' if args.smoke else 'single_source_verification' if args.source_url else 'one_group' if args.group else 'all_groups','coverageStatus':'smoke' if args.smoke else 'failed','smoke':args.smoke,'startedAt':started,'finishedAt':now(),'exitCode':code,'timedOut':timedout,'draftsCreated':0,'submissionsPerformed':0,'publicationsPerformed':0,'sourceChecks':[],'error':None}
    try:
        if code!=0: raise ValueError('CLI failed; inspect private sanitized cli.log')
        resultfile=rundir/'result.raw.json'
        if resultfile.is_symlink() or resultfile.resolve().parent!=rundir.resolve(): raise ValueError('Unsafe result path')
        if resultfile.stat().st_size>250000: raise ValueError('Result exceeded size bound')
        data=json.loads(resultfile.read_text())
        if args.smoke:
            if data.get('checks') or data.get('drafts') or data.get('expiryCandidates'): raise ValueError('Smoke unexpectedly produced content')
        else:
            validate(data,groups)
            known_urls={canonical(x['sourceUrl']) for x in dedup if x.get('sourceUrl')}
            known_titles={titlekey(x['title']) for x in dedup if x.get('title')}
            for d in data['drafts']:
                url=canonical(d['sourceUrl'])
                if titlekey(d['title']) in known_titles: continue
                update=url in known_urls
                if update:
                    # Stable manufacturer/call URLs can contain a genuinely new version/edition.
                    if not (d.get('updateOfKnownSource') and d.get('editionOrVersion') and d.get('updateReason') and d.get('sourcePublishedOn')): continue
                    version=titlekey(d['editionOrVersion'])
                    if any(x.get('sourceUrl') and canonical(x['sourceUrl'])==url and (titlekey(x.get('editionOrVersion') or '')==version or version in titlekey(x.get('title') or '')) for x in dedup+state['knownDrafts']): continue
                identity=url+'\n'+(d.get('editionOrVersion') or '')
                key=hashlib.sha256(identity.encode()).hexdigest()[:24]
                d.update(sourceUrl=url,key=key,language='en',status='private_server_material_update_review' if update else 'private_server_research_draft',existingSourceUrlMatch=update,needsMergeReview=update,liveDuplicateCheckRequired=True,imagePending=True,privateProductSaveVerified=False,submissionVerified=False,createdAt=now())
                atomic(ROOT/'drafts'/(key+'.json'),d); receipt['draftsCreated']+=1
                brief={k:d.get(k) for k in ('key','title','sourceUrl','deadline','eventStart','eventEnd','editionOrVersion','sourcePublishedOn','status')}; state['knownDrafts'].append(brief)
                known_urls.add(url);known_titles.add(titlekey(d['title']))
            for c in data['checks']:
                slot=state['groups'].setdefault(c['groupId'],{}); slot.update(lastAttemptAt=now(),lastStatus=c['status'],lastNote=c['note'])
                if c['status']=='checked' and not args.source_url and next(g for g in groups if g['id']==c['groupId']).get('allSourcesInGroupRequested',True): slot['lastSuccessfulAt']=now()
                if c['status']=='checked':
                    for u in c['checkedUrls']:
                        state.setdefault('sources',{})[canonical(u)]={'lastSuccessfulAt':now(),'groupId':c['groupId'],'scope':'single_source' if args.source_url else 'group_check'}
            atomic(rundir/'result.json',data); receipt['sourceChecks']=data['checks']
            receipt['coverageStatus']='checked' if all(c['status']=='checked' for c in data['checks']) else 'partial'
            state['runs']=(state['runs']+[{'runId':stamp,'at':now(),'draftsCreated':receipt['draftsCreated']}])[-100:]
            atomic(statefile,state)
    except Exception as e: receipt['error']=str(e)
    atomic(rundir/'receipt.json',receipt); atomic(ROOT/'state'/('latest-smoke.json' if args.smoke else 'latest-run.json'),receipt)
    # Keep at most100 run directories; draft/state/dedup files are never rotated.
    runsroot=(ROOT/'runs').resolve()
    dirs=sorted(p for p in runsroot.iterdir() if not p.is_symlink() and p.is_dir() and p.resolve().parent==runsroot)
    for old in dirs[:-100]:
        for f in old.iterdir():
            if not f.is_symlink() and f.is_file() and f.resolve().parent==old.resolve(): f.unlink()
        try: old.rmdir()
        except OSError: pass
    print(json.dumps(receipt,ensure_ascii=False))
    return 1 if receipt['error'] else 0

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--group');p.add_argument('--source-url');p.add_argument('--smoke',action='store_true');p.add_argument('--timeout',type=int,default=540)
    args=p.parse_args()
    if args.timeout<10 or args.timeout>600: p.error('timeout must be10..600')
    os.umask(0o077)
    try: sys.exit(run(args))
    except Exception as e: print(json.dumps({'mode':'research_only','error':str(e)}));sys.exit(1)
