"""Trusted controller bridge: reviewed originals → protected product media.

Activation requires the separately deployed gallery/credit contract. This module
never relaxes article ownership, source provenance, review or revision guards.
"""
import hashlib
import datetime as dt
import json
import re
from pathlib import Path
import urllib.error

import publisher as pub
import media


def gallery_image(record):
    creator = record['author']
    attribution = record.get('requiredAttribution') or ''
    credit = record.get('originalCredit') or ''
    if len(creator) > 200 or len(attribution) > 1000 or len(credit) > 500:
        raise ValueError('Required complete credit exceeds product field; manual review needed')
    # The original title is deliberately retained for older CC attribution terms;
    # the separate caption identifies archive context, year and actual occasion.
    if not 1 <= len(record['title']) <= 300:
        raise ValueError('Image title exceeds credit contract')
    return {'url': record['protectedUrl'], 'altText': record['alt'], 'caption': record['caption'],
            'imageTitle': record['title'], 'creator': creator, 'attribution': attribution, 'credit': credit, 'sourceUrl': record['sourceUrl'],
            'licenseName': record['license'], 'licenseUrl': record['licenseUrl'], 'changes': record['changes']}


def prepare_for_entry(api, entry_id, draft, review, run, row):
    activation = json.loads((pub.ROOT / 'media/enabled').read_text())
    if activation.get('contract') != 'news-gallery-v1' or not activation.get('productLiveVerifiedAt'):
        raise ValueError('Gallery/credit contract not independently activated')
    journal = pub.ROOT / 'media/entries' / (entry_id + '.json')
    context = hashlib.sha256(json.dumps({k: review[k] for k in ('title', 'summary', 'description')}, sort_keys=True).encode()).hexdigest()
    if journal.exists():
        saved = json.loads(journal.read_text())
        if saved.get('sourceUrl') != draft['sourceUrl'] or saved.get('contextSha256') != context:
            raise ValueError('Existing image belongs to another reviewed article revision')
        if saved.get('state') not in ('uploaded_private', 'no_eligible_image'):
            raise ValueError('Image upload recovery requires the original record')
        records = saved.get('images') or []
        for record in records:
            if not record.get('publishedSha256') or not record.get('normalization'):
                raise ValueError('Saved photo requires independent derivative review')
            age = (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(record['checkedAt'])).total_seconds()
            if not 0 <= age < 300:
                pages = media.api_query({'titles': 'File:' + record['title'], 'prop': 'imageinfo|categories', 'cllimit': 100, 'iiprop': 'url|sha1|size|mime|extmetadata'})
                if len(pages) != 1:
                    raise ValueError('Original image rights cannot be refreshed')
                fresh = media.file_record(pages[0])
                for key in ('sha1', 'author', 'license', 'licenseUrl', 'requiredAttribution', 'originalCredit', 'sourceUrl', 'originalUrl', 'depictedSubject', 'imageDate'):
                    if fresh.get(key) != record.get(key):
                        raise ValueError('Original image or its rights/context changed; preserve private')
                record.update(checkedAt=fresh['checkedAt'], metadataSha256=fresh['metadataSha256'])
        if records:
            saved.update(images=records, checkedAt=pub.now())
            pub.atomic(journal, saved)
        return [gallery_image(record) for record in records], records
    if row and row.get('image_url'):
        raise ValueError('Existing photo without this worker image receipt; preserve unchanged')
    if not run:
        raise ValueError('Actual image review directory required')
    record, reason = None, ''
    try:
        record = media.prepare(draft, review, run)
    except (ValueError, OSError, urllib.error.URLError) as exc:
        # No ambiguous image is attached. Optional, verified text remains valid.
        reason = type(exc).__name__
    receipt = {'sourceUrl': draft['sourceUrl'], 'contextSha256': context, 'checkedAt': pub.now(),
               'state': 'no_eligible_image', 'images': [], 'reason': reason or 'No contextually suitable licensed and visually verified file'}
    if record:
        # No model-generated URL is accepted. api.upload verifies original bytes
        # again after visual review and restricts the returned canonical origin.
        record['protectedUrl'] = api.upload(Path(record['uploadPath']), entry_id, record['uploadSha256'], record['uploadMime'])
        gallery_image(record)  # validate all required visible credits before save
        receipt.update(state='uploaded_private', images=[record], reason='Per-file licence, original digest and actual visual review passed')
    pub.atomic(journal, receipt)
    records = receipt['images']
    return [gallery_image(item) for item in records], records
