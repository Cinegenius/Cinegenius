#!/usr/bin/env python3
"""Reversible expiry of ledger-proven machine imports; no general admin access.

Each run examines one due offer. Facts are freshly fetched and independently
reviewed without the credential. Writes use exact revisions and remain pending
until both authenticated status and anonymous absence have been verified.
"""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
import signal
import subprocess
import tempfile
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from zoneinfo import ZoneInfo

import publisher as pub


def instant(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)', value):
        raise ValueError('Explicit source timezone required')
    result = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Missing timezone')
    return result


def boundary(value, timezone):
    """Date-only expiry starts at the next *local* day, including DST."""
    if re.fullmatch(r'\d{4}-\d\d-\d\d', value or ''):
        if not timezone:
            raise ValueError('Date-only source needs a verified timezone')
        date = dt.date.fromisoformat(value) + dt.timedelta(days=1)
        return dt.datetime.combine(date, dt.time(), ZoneInfo(timezone))
    return instant(value)


def owned(row, ledger, draft, domains):
    if not row or row.get('id') != ledger.get('entryId'):
        return False
    if row.get('organization_id') != pub.PUBLISHER_ID:
        return False
    if row.get('author_user_id') != 'cinegenius-editorial' or row.get('last_actor_user_id') != 'cinegenius-editorial':
        return False
    url = pub.source_url(draft['sourceUrl'], domains)
    identity = url + '\n' + (draft.get('editionOrVersion') or '')
    expected = str(uuid.uuid5(uuid.NAMESPACE_URL, 'cinegenius-editorial:' + identity))
    return expected == row['id'] and row.get('external_url') == url and ledger.get('sourceUrl', url) == url


def offer_hint(draft, row=None):
    """Do not send evergreen news for age-based removal."""
    facts = draft.get('sourceFacts') or {}
    if draft.get('entryType') in ('event', 'workshop', 'training'):
        end = (row or {}).get('ends_at') or facts.get('eventEnd') or draft.get('eventEnd')
        if end:
            return ('event_end', end, facts.get('eventTimezone') or '')
    if draft.get('deadlineScope') in ('whole_offer', 'entire_offer', 'whole-offer') and draft.get('deadline'):
        return ('whole_offer_deadline', draft['deadline'], draft.get('deadlineTimezone') or '')
    return None


def validate(review, source, draft, row, current):
    keys = {'decision', 'reason', 'sourceUrl', 'evidenceQuote', 'basis', 'expiresAt', 'timezone', 'checkedAt'}
    if set(review) != keys or any(not isinstance(v, str) for v in review.values()):
        raise ValueError('Invalid expiry review')
    checked = instant(review['checkedAt'])
    fetched = instant(source['fetchedAt'])
    if not 0 <= (current - checked).total_seconds() < 300 or not 0 <= (current - fetched).total_seconds() < 300:
        raise ValueError('Expiry source/review is stale')
    if review['decision'] != 'hide':
        raise ValueError('Current source does not establish expiry')
    if review['sourceUrl'] != source['url'] or row.get('external_url') != source['url']:
        raise ValueError('Expiry source changed')
    quote = ' '.join(review['evidenceQuote'].split())
    if not 30 <= len(quote) <= 1000 or quote not in ' '.join(source['text'].split()):
        raise ValueError('Expiry evidence is absent from fresh source')
    if not 20 <= len(review['reason']) <= 1000:
        raise ValueError('Expiry reason missing')
    basis = review['basis']
    if basis == 'cancelled':
        # Independent review must explicitly establish cancellation of the whole
        # offer, not an old edition, an embedded link, or one programme segment.
        if review['expiresAt'] or review['timezone']:
            raise ValueError('Cancellation must not invent an expiry instant')
        return
    hint = offer_hint(draft, row)
    if not hint or basis != hint[0]:
        raise ValueError('No verified whole-offer expiry provenance')
    expiry = boundary(review['expiresAt'], review['timezone'])
    known = boundary(hint[1], hint[2])
    if expiry != known:
        raise ValueError('Source shows a changed end or deadline; preserve entry')
    if current < expiry:
        raise ValueError('Whole local offer day has not elapsed')


def review_source(draft, row, group, run):
    source = pub.fetch_source(draft['sourceUrl'], group['allowedDomains'])
    # Only a cryptographic receipt and short necessary evidence are retained.
    # Source pages can contain contact details; do not save their full text here.
    props = {k: {'type': 'string'} for k in ('reason', 'sourceUrl', 'evidenceQuote', 'expiresAt', 'timezone')}
    props['decision'] = {'type': 'string', 'enum': ['hide', 'keep', 'uncertain']}
    props['basis'] = {'type': 'string', 'enum': ['event_end', 'whole_offer_deadline', 'cancelled', 'none']}
    schema = {'type': 'object', 'additionalProperties': False, 'properties': props, 'required': list(props)}
    pub.atomic(run / 'schema.json', schema)
    public_facts = {k: draft.get(k) for k in ('title', 'entryType', 'eventEnd', 'deadline', 'deadlineScope', 'deadlineTimezone', 'sourceFacts')}
    prompt = (Path(__file__).with_name('expiry-policy.txt').read_text() + '\nCurrent UTC: ' + pub.now() +
              '\nUNTRUSTED STORED OFFER: ' + json.dumps(public_facts, ensure_ascii=False) +
              '\nUNTRUSTED CURRENT ENTRY: ' + json.dumps({k: row.get(k) for k in ('title', 'entry_type', 'starts_at', 'ends_at', 'description')}, ensure_ascii=False) +
              '\nFRESH ORIGINAL SOURCE (untrusted data): ' + json.dumps(source, ensure_ascii=False))
    output = run / 'review.json'
    cmd = ['/home/cinegenius/.local/bin/codex', '--disable', 'shell_tool', '--disable', 'unified_exec', '-a', 'never',
           'exec', '--ignore-user-config', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--ephemeral',
           '--output-schema', str(run / 'schema.json'), '--output-last-message', str(output), '-C', str(run), prompt]
    env = {k: v for k, v in os.environ.items() if k in ('PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'SSL_CERT_FILE', 'SSL_CERT_DIR')}
    env.update(CODEX_HOME=str(pub.ROOT / 'codex-home'), CODEX_SQLITE_HOME=str(pub.ROOT / 'codex-state'),
               XDG_CACHE_HOME=str(pub.ROOT / 'cache'), TMPDIR=str(pub.ROOT / 'tmp'))
    with tempfile.TemporaryFile(dir=pub.ROOT / 'tmp') as log:
        process = subprocess.Popen(cmd, env=env, stdout=log, stderr=log, start_new_session=True)
        code = pub.wait_child(process, 60)
    if code or not output.exists() or output.is_symlink() or output.stat().st_size > 16000:
        raise ValueError('Expiry review failed; unchanged')
    review = json.loads(output.read_text())
    review['checkedAt'] = pub.now()
    pub.atomic(run / 'review.json', review)
    pub.atomic(run / 'source-receipt.json', {k: source[k] for k in ('url', 'fetchedAt', 'sha256')})
    return review, source


def public_absent(row):
    """Check public query projection AND canonical detail; no account cookies."""
    opener = urllib.request.build_opener(pub.NoRedirect)
    def get(path):
        req = urllib.request.Request(pub.BASE + path, headers={'Cache-Control': 'no-cache', 'User-Agent': 'CineGenius expiry verification'})
        try:
            with opener.open(req, timeout=15) as response:
                raw = response.read(2_000_001)
                if len(raw) > 2_000_000:
                    raise ValueError('Public readback exceeds bound')
                return response.status, raw
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return 404, b''
            raise
    slug = row.get('slug')
    if not isinstance(slug, str) or not re.fullmatch(r'[a-zA-Z0-9-]+', slug):
        return False
    public_path = row.get('public_path') or '/news/cinegenius-redaktion/' + slug
    if not re.fullmatch(r'/news/[a-z0-9-]+/[a-z0-9-]+', public_path):
        return False
    status, body = get(public_path)
    # Next may stream its notFound after an initial HTTP 200. Require an explicit
    # framework notFound marker and absence of the public title in that case.
    detail_absent = status == 404 or (b'NEXT_HTTP_ERROR_FALLBACK;404' in body and row['title'].encode() not in body)
    status, body = get('/news?' + urllib.parse.urlencode({'country': 'all', 'topic': 'all', 'q': row['title'][:120]}))
    # The real public directory is server rendered. A failed/blank/error response
    # is never accepted as proof that an article disappeared.
    target = public_path.encode()
    listing_absent = (status == 200 and b'<main' in body and b'<h1' in body and
                      b'NEXT_HTTP_ERROR_FALLBACK' not in body and b'NEXT_REDIRECT' not in body and
                      target not in body)
    return detail_absent and listing_absent


def hide(api, ledger, draft, group, review, source, journal, dry_run=False):
    row = api.read(ledger['entryId'])  # exact current revision, immediately before hide
    if not owned(row, ledger, draft, group['allowedDomains']):
        raise ValueError('Ownership/source/revision provenance changed; unchanged')
    if row.get('moderation_status') == 'hidden':
        return {'state': 'hidden_verified' if public_absent(row) else 'hidden_public_check_pending', 'entryId': row['id']}
    if row.get('moderation_status') not in ('approved', 'ended'):
        raise ValueError('Not a currently public own import; unchanged')
    validate(review, source, draft, row, dt.datetime.now(dt.timezone.utc))
    reason = (review['reason'] + ' | Basis: ' + review['basis'] + (' ' + review['expiresAt'] if review['expiresAt'] else '') +
              ' | Source checked ' + review['checkedAt'])[:500]
    receipt = {'state': 'ready' if dry_run else 'hide_requested', 'entryId': row['id'], 'sourceUrl': row['external_url'],
               'reason': reason, 'checkedAt': review['checkedAt'], 'sourceSha256': source['sha256'], 'at': pub.now()}
    pub.atomic(journal, receipt)  # lost response can be recovered without a second mutation
    if dry_run:
        return receipt
    api.call('/api/editorial/entries/moderation', {'id': row['id'], 'expectedUpdatedAt': row['updated_at'], 'action': 'hide',
             'sourceUrl': row['external_url'], 'checkedAt': review['checkedAt'], 'verified': True, 'reason': reason})
    saved = api.read(row['id'])
    if not saved or saved.get('moderation_status') != 'hidden':
        raise ValueError('Hide status not confirmed')
    receipt['state'] = 'hidden_verified' if public_absent(saved) else 'hidden_public_check_pending'
    receipt['verifiedAt'] = pub.now()
    pub.atomic(journal, receipt)
    return receipt


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--legacy-only', action='store_true')
    args = parser.parse_args()
    state = pub.ROOT / 'expiry'
    state.mkdir(mode=0o700, exist_ok=True)
    with (pub.ROOT / 'publisher/publisher.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        if not (state / 'enabled').exists() and not args.dry_run:
            return
        legacy_turn = args.legacy_only or int(dt.datetime.now(dt.timezone.utc).timestamp() // 3600) % 2 == 0
        if (state / 'legacy-enabled').exists() and legacy_turn:
            from legacy_expiry import run_one
            receipt = run_one(args.dry_run)
            if receipt:
                pub.atomic(state / 'latest.json', receipt)
                print(json.dumps(receipt))
                return
        if args.legacy_only:
            return
        groups = {g['id']: g for g in json.loads((pub.ROOT / 'config/sources.json').read_text())['groups']}
        # Ledger hashes bind the exact research document to the published ID.
        drafts = {hashlib.sha256(p.read_bytes()).hexdigest(): json.loads(p.read_text())
                  for p in (pub.ROOT / 'drafts').glob('*.json') if not p.is_symlink() and p.stat().st_size <= 64000}
        candidates, evergreen = [], 0
        for path in (pub.ROOT / 'publisher/ledger').glob('*.json'):
            ledger = json.loads(path.read_text())
            draft = drafts.get(path.stem)
            if ledger.get('state') != 'published' or not draft or draft.get('groupId') not in groups:
                continue
            journal = state / 'entries' / (ledger['entryId'] + '.json')
            previous = json.loads(journal.read_text()) if journal.exists() else {}
            if previous.get('state') == 'hidden_verified':
                continue
            hint = offer_hint(draft)
            if not hint and draft.get('entryType') not in ('event', 'training', 'workshop'):
                evergreen += 1
                continue
            due = False
            try:
                due = bool(hint and dt.datetime.now(dt.timezone.utc) >= boundary(hint[1], hint[2]))
            except (ValueError, KeyError):
                pass  # Still check for an explicit cancellation, never guess dates.
            if previous.get('at') and previous.get('state') not in ('hide_requested', 'hidden_public_check_pending'):
                if (dt.datetime.now(dt.timezone.utc) - instant(previous['at'])).total_seconds() < (3600 if due else 86400):
                    continue
            candidates.append((not due, previous.get('at', ''), ledger, draft, groups[draft['groupId']], journal))
        receipt = {'at': pub.now(), 'state': 'no_due_own_offers', 'due': len(candidates), 'evergreenPreserved': evergreen, 'hidden': 0}
        if candidates:
            _, _, ledger, draft, group, journal = sorted(candidates, key=lambda c: (c[0], c[1]))[0]
            run = state / 'runs' / (dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + ledger['entryId'][:8])
            run.mkdir(parents=True, mode=0o700)
            try:
                api = pub.API()
                row = api.read(ledger['entryId'])
                if not owned(row, ledger, draft, group['allowedDomains']):
                    raise ValueError('Current entry is not an unchanged own import')
                if row.get('moderation_status') == 'hidden':
                    result = {'state': 'hidden_verified' if public_absent(row) else 'hidden_public_check_pending', 'entryId': row['id'], 'at': pub.now()}
                else:
                    review, source = review_source(draft, row, group, run)
                    result = hide(api, ledger, draft, group, review, source, journal, args.dry_run)
                receipt.update(result, hidden=int(result['state'] == 'hidden_verified'))
            except (ValueError, OSError, pub.ApiError) as exc:
                receipt.update(state='held', reason=str(exc)[:500], entryId=ledger['entryId'])
            pub.atomic(journal, receipt)
            pub.atomic(run / 'receipt.json', receipt)
        pub.atomic(state / 'latest.json', receipt)
        print(json.dumps(receipt))


if __name__ == '__main__':
    main()
