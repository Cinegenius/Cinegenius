"""Explicit research/review conflict contract. No publication capability."""

CONFLICT_SCHEMA = {
    'type': 'array', 'maxItems': 6,
    'items': {'type': 'string', 'minLength': 1, 'maxLength': 1000},
}

RESEARCH_CONFLICT_POLICY = '''
Every draft must include sourceConflicts: an array describing ALL unresolved
contradictions between sources, including fees/taxes, dates, eligibility and
edition/version. Include the relevant checked URLs in confirmationUrls and
identify both differing claims in the conflict description. An empty array means
you actually checked and found no unresolved contradictions; missing information
is not proof of agreement. Do not hide conflicts only in rightsNote, remove them
because the draft omits a disputed detail, or select a preferred source by guess.
Conflicted drafts remain private for editorial correction, never automatic
publication. Existing private drafts without this declaration require fresh
source review; never fill an empty array merely to make them publishable.
'''


def conflicts(record):
    value = record.get('sourceConflicts')
    if (not isinstance(value, list) or len(value) > 6
            or any(not isinstance(item, str) or not item.strip() or len(item) > 1000
                   for item in value)):
        raise ValueError('Missing or invalid source-conflict check; fresh source review required')
    return value


def require_no_conflicts(record):
    if conflicts(record):
        raise ValueError('Unresolved source conflicts; retain privately for editorial correction')
