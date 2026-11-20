#!/usr/bin/env python3
"""Consume real, suppressed aggregate article observations. Never deletes news.

The publishing token is used only by this controller, not by research. A missing,
stale, sparse or unavailable measurement stays cold, with balanced selection.
"""
import datetime as dt
import json
import math
import re
import statistics
import urllib.parse

import publisher as pub


def analyse(feed, current):
    if feed.get('contract') != 'news-readership-v1' or feed.get('coverage') != 'consenting_visits_only' or feed.get('metric') != 'observations_not_people':
        raise ValueError('Unsupported readership contract')
    if feed.get('status') not in ('ready', 'cold_start', 'insufficient_data'):
        raise ValueError('Readership is unavailable')
    window = feed.get('window') or {}
    start = dt.datetime.fromisoformat(window['from'].replace('Z', '+00:00'))
    until = dt.datetime.fromisoformat(window['until'].replace('Z', '+00:00'))
    if start.tzinfo is None or until.tzinfo is None or window.get('timeZone') != 'UTC' or not 0 < (until - start).total_seconds() <= 28 * 86400 or not 0 <= (current - until).total_seconds() <= 2 * 86400:
        raise ValueError('Readership window invalid or stale')
    thresholds = feed.get('thresholds') or {}
    if any(type(thresholds.get(k)) is not int or thresholds[k] < v for k, v in [('impressions', 20), ('views', 5), ('minimumAgeHours', 48)]):
        raise ValueError('Readership suppression/age thresholds missing')
    rows = feed.get('entries')
    if not isinstance(rows, list) or len(rows) > 300:
        raise ValueError('Readership bounds')
    topics, seen = {}, set()
    for row in rows:
        if not isinstance(row, dict) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', row.get('id', '')) or row['id'] in seen:
            raise ValueError('Invalid/duplicate aggregate article')
        seen.add(row['id'])
        if row.get('topic') not in pub.TOPICS or row.get('state') != 'ready' or row.get('learningEligible') is not True:
            continue
        impressions, views = row.get('impressions'), row.get('views')
        if type(impressions) is not int or type(views) is not int or not thresholds['impressions'] <= impressions <= 10**9 or not thresholds['views'] <= views <= impressions:
            continue
        totals = topics.setdefault(row['topic'], {'articles': 0, 'impressions': 0, 'views': 0})
        totals['articles'] += 1
        totals['impressions'] += impressions
        totals['views'] += views
    # One popular title must not steer a whole category. Counts describe voluntary
    # observations, not people or causally attributed click-through conversions.
    eligible = {k: v for k, v in topics.items() if v['articles'] >= 3 and v['impressions'] >= 100 and v['views'] >= 20}
    weights = {}
    if len(eligible) >= 2:
        rates = {k: (v['views'] + 5) / (v['impressions'] + 50) for k, v in eligible.items()}
        baseline = statistics.median(rates.values())
        weights = {k: round(max(0.9, min(1.1, 1 + 0.1 * (rate / baseline - 1))), 3) for k, rate in rates.items()}
    return {'status': 'ready' if weights else 'insufficient_data' if rows else 'cold_start',
            'topicWeights': weights, 'eligibleTopics': eligible, 'eligibleArticles': sum(v['articles'] for v in eligible.values()),
            'window': window, 'coverage': feed['coverage'], 'metric': feed['metric'],
            'limits': {'minimumArticlesPerTopic': 3, 'minimumComparedTopics': 2, 'maximumWeightChange': 0.1,
                       'noAutomaticRemoval': True, 'urgencyAndSourceQualityTakePrecedence': True}}


def research_context(root, current):
    balanced = {'status': 'cold_start', 'topicWeights': {}, 'noAutomaticRemoval': True}
    path = root / 'context/news-readership.json'
    if not path.exists():
        return balanced
    try:
        data = json.loads(path.read_text())
        age = (current - dt.datetime.fromisoformat(data['checkedAt'])).total_seconds()
        if not 0 <= age <= 36 * 3600 or data.get('status') != 'ready':
            return {**balanced, 'status': data.get('status') if data.get('status') in ('unavailable', 'cold_start', 'insufficient_data') else 'stale'}
        weights = data['topicWeights']
        if not isinstance(weights, dict) or len(weights) > len(pub.TOPICS) or any(k not in pub.TOPICS or type(v) not in (int, float) or not math.isfinite(v) or not 0.9 <= v <= 1.1 for k, v in weights.items()):
            return {**balanced, 'status': 'invalid'}
        return {'status': 'ready', 'topicWeights': weights, 'coverage': 'consenting_visits_only', 'metric': 'observations_not_people',
                'noAutomaticRemoval': True, 'instruction': 'Use only as a modest editorial tie-breaker. Timely verified opportunities, source quality and country coverage take precedence. Never invent interest or omit an entire country/theme because of sparse measurements.'}
    except (OSError, ValueError, TypeError, KeyError):
        return {**balanced, 'status': 'invalid'}


def main():
    state = pub.ROOT / 'feedback'
    state.mkdir(mode=0o700, exist_ok=True)
    if not (state / 'enabled').exists():
        return
    receipt = {'checkedAt': pub.now(), 'status': 'unavailable', 'topicWeights': {}, 'source': '/api/editorial/readership'}
    # A killed refresh must not leave yesterday's ready state masquerading as a
    # successful current provider/permission check.
    pub.atomic(pub.ROOT / 'context/news-readership.json', receipt)
    try:
        api = pub.API()
        feed = api.call('/api/editorial/readership?' + urllib.parse.urlencode({'organizationId': pub.PUBLISHER_ID}))
        # Partial pagination cannot silently bias comparison toward the first IDs.
        # The present newsroom is below 100. Raise the bound only with a bounded
        # cursor-consistent multi-page implementation if it actually grows.
        if feed.get('nextCursor'):
            raise ValueError('Aggregate coverage partial; balanced selection retained')
        receipt.update(analyse(feed, dt.datetime.now(dt.timezone.utc)))
    except (pub.ApiError, OSError, ValueError, TypeError, KeyError) as exc:
        receipt['reason'] = type(exc).__name__
    pub.atomic(state / 'latest.json', receipt)
    pub.atomic(pub.ROOT / 'context/news-readership.json', receipt)
    print(json.dumps({k: receipt.get(k) for k in ('checkedAt', 'status', 'eligibleArticles')}))


if __name__ == '__main__':
    main()
