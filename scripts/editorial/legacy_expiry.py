"""Hide-only bridge for individually admin-reviewed, proven historical imports.

This is intentionally separate from machine authorship. It never adopts an old
author, edits a body, creates a publisher, grants authority or publishes anything.
"""
import datetime as dt
import hashlib
import json
import re
import urllib.parse
from pathlib import Path

import expiry
import publisher as pub


def load_records(root):
    registry = root / 'expiry/legacy-imports.json'
    if not registry.exists():
        return []
    refs = json.loads(registry.read_text())
    if not isinstance(refs, list) or len(refs) > 100:
        raise ValueError('Legacy registry bounds')
    result, seen = [], set()
    for ref in refs:
        id = ref['entryId']
        if not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', id) or id in seen:
            raise ValueError('Invalid/duplicate legacy ID')
        seen.add(id)
        proof = root / 'context/legacy-provenance' / (id + '.json')
        if proof.is_symlink() or proof.stat().st_size > 64000 or hashlib.sha256(proof.read_bytes()).hexdigest() != ref['evidenceSha256']:
            raise ValueError('Legacy evidence bytes changed')
        document = json.loads(proof.read_text())
        entry = document['entry']
        if entry.get('entry_id') != id or entry.get('source_url') != ref['sourceUrl'] or entry.get('title') != ref['title']:
            raise ValueError('Legacy provenance does not bind this entry')
        url = urllib.parse.urlsplit(ref['publicUrl'])
        if url.scheme != 'https' or url.netloc != 'www.cinegenius.co' or url.query or url.fragment or not re.fullmatch(r'/news/[a-z0-9-]+/[a-z0-9-]+', url.path):
            raise ValueError('Legacy public route not canonical')
        result.append({**ref, 'provenance': entry, 'publicPath': url.path})
    return result


def grant_for(api, ref):
    response = api.call('/api/editorial/legacy-expiry?' + urllib.parse.urlencode({'organizationId': ref['organizationId']}))
    if response.get('truncated') or response.get('nextCursor'):
        raise ValueError('Partial legacy grant coverage; unchanged')
    grants = response.get('grants')
    if not isinstance(grants, list) or len(grants) > 100:
        raise ValueError('Invalid legacy grant response')
    grant = next((g for g in grants if g.get('id') == ref['entryId']), None)
    if grant:
        if any(grant.get(k) != ref[v] for k, v in [('organizationId', 'organizationId'), ('sourceUrl', 'sourceUrl'), ('evidenceSha256', 'evidenceSha256')]):
            raise ValueError('Legacy grant belongs to another provenance/source')
        expiry.instant(grant['expectedUpdatedAt'])
        if expiry.instant(grant['validUntil']) <= dt.datetime.now(dt.timezone.utc):
            raise ValueError('Legacy entitlement expired')
    return grant


def status(api, ref):
    return api.call('/api/editorial/legacy-expiry?' + urllib.parse.urlencode({'organizationId': ref['organizationId'], 'id': ref['entryId']})).get('entry')


def public_row(ref):
    return {'id': ref['entryId'], 'title': ref['title'], 'external_url': ref['sourceUrl'],
            'slug': ref['publicPath'].split('/')[-1], 'public_path': ref['publicPath'],
            'ends_at': ref['provenance']['ends_local'], 'entry_type': 'workshop'}


def maintain_one(api, ref, group, run, journal, dry_run=False):
    row = public_row(ref)
    grant = grant_for(api, ref)
    if not grant:
        try:
            saved = status(api, ref)
        except pub.ApiError as exc:
            if exc.status != 403:
                raise
            saved = None
        if saved and saved.get('id') == ref['entryId'] and saved.get('currentStatus') == 'hidden':
            return {'state': 'already_hidden_verified' if expiry.public_absent(row) else 'hidden_public_check_pending', 'entryId': ref['entryId'], 'hidden': 0}
        return {'state': 'legacy_admin_grant_required', 'entryId': ref['entryId'], 'hidden': 0}
    proof = ref['provenance']
    draft = {'title': ref['title'], 'sourceUrl': ref['sourceUrl'], 'entryType': 'workshop',
             'eventEnd': proof['ends_local'], 'sourceFacts': {'eventEnd': proof['ends_local']}, 'deadlineScope': 'unspecified'}
    review, source = expiry.review_source(draft, row, group, run)
    expiry.validate(review, source, draft, row, dt.datetime.now(dt.timezone.utc))
    # Bind the grant's reviewed whole-offer expiry too; no replacement edition.
    if expiry.instant(grant['contentExpiresAt']) != expiry.instant(proof['ends_local']):
        raise ValueError('Legacy entitlement expiry differs from this exact offer')
    current = grant_for(api, ref)  # immediate current capability + revision check
    if not current or current != grant:
        raise ValueError('Legacy entitlement changed during source review')
    reason = (review['reason'] + ' | ' + review['basis'] + ' ' + review['expiresAt'] + ' | Source checked ' + review['checkedAt'])[:500]
    receipt = {'state': 'ready' if dry_run else 'legacy_hide_requested', 'entryId': ref['entryId'], 'sourceUrl': ref['sourceUrl'],
               'evidenceSha256': ref['evidenceSha256'], 'sourceSha256': source['sha256'], 'reason': reason, 'at': pub.now(), 'hidden': 0}
    pub.atomic(journal, receipt)
    if dry_run:
        return receipt
    api.call('/api/editorial/legacy-expiry', {'id': ref['entryId'], 'expectedUpdatedAt': grant['expectedUpdatedAt'],
             'sourceUrl': ref['sourceUrl'], 'checkedAt': review['checkedAt'], 'evidenceSha256': ref['evidenceSha256'],
             'verified': True, 'reason': reason})
    saved = status(api, ref)
    if not saved or saved.get('id') != ref['entryId'] or saved.get('currentStatus') != 'hidden' or not saved.get('usedAt'):
        raise ValueError('Legacy persisted hidden status not confirmed')
    receipt.update(state='hidden_verified' if expiry.public_absent(row) else 'hidden_public_check_pending', verifiedAt=pub.now())
    receipt['hidden'] = int(receipt['state'] == 'hidden_verified')
    pub.atomic(journal, receipt)
    return receipt


def run_one(dry_run=False):
    state = pub.ROOT / 'expiry'
    records = load_records(pub.ROOT)
    if not records:
        return None
    groups = {g['id']: g for g in json.loads((pub.ROOT / 'config/sources.json').read_text())['groups']}
    candidates = []
    for ref in records:
        journal = state / 'legacy-entries' / (ref['entryId'] + '.json')
        previous = json.loads(journal.read_text()) if journal.exists() else {}
        if previous.get('state') in ('hidden_verified', 'already_hidden_verified'):
            continue
        candidates.append((previous.get('at', ''), ref, journal))
    if not candidates:
        return None
    _, ref, journal = sorted(candidates, key=lambda c: c[0])[0]
    run = state / 'runs' / (dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-legacy-' + ref['entryId'][:8])
    run.mkdir(parents=True, mode=0o700)
    receipt = {'at': pub.now(), 'hidden': 0, 'entryId': ref['entryId']}
    try:
        group = groups[ref['groupId']]
        if pub.source_url(ref['sourceUrl'], group['allowedDomains']) != ref['sourceUrl']:
            raise ValueError('Legacy source requires canonical reconciliation')
        receipt.update(maintain_one(pub.API(), ref, group, run, journal, dry_run))
    except (OSError, pub.ApiError, ValueError, KeyError) as exc:
        receipt.update(state='legacy_held', reason=str(exc)[:500])
    pub.atomic(journal, receipt)
    return receipt
