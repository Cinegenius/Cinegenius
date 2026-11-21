import datetime as dt
import tempfile
import unittest
import uuid
import urllib.error
from pathlib import Path
from unittest.mock import patch

import expiry as e


class ExpiryTests(unittest.TestCase):
    def setUp(self):
        self.current = dt.datetime(2026, 11, 21, 0, 30, tzinfo=dt.timezone.utc)
        self.url = 'https://example.org/workshop'
        self.draft = {'sourceUrl': self.url, 'entryType': 'workshop', 'eventEnd': '2026-11-20',
                      'sourceFacts': {'eventEnd': '2026-11-20', 'eventTimezone': 'Europe/Berlin'}}
        self.id = str(uuid.uuid5(uuid.NAMESPACE_URL, 'cinegenius-editorial:' + self.url + '\n'))
        self.row = {'id': self.id, 'organization_id': e.pub.PUBLISHER_ID, 'author_user_id': 'cinegenius-editorial',
                    'last_actor_user_id': 'cinegenius-editorial', 'external_url': self.url, 'updated_at': 'v1',
                    'moderation_status': 'approved', 'title': 'Workshop', 'slug': self.id}
        self.ledger = {'entryId': self.id, 'sourceUrl': self.url, 'state': 'published'}
        self.quote = 'The complete workshop takes place on 20 November 2026 and finishes that day.'
        self.source = {'url': self.url, 'text': self.quote, 'fetchedAt': self.current.isoformat(), 'sha256': 'a' * 64}
        self.review = {'decision': 'hide', 'reason': 'The complete one-day workshop has ended, with no extension stated.',
                       'basis': 'event_end', 'expiresAt': '2026-11-20', 'timezone': 'Europe/Berlin',
                       'evidenceQuote': self.quote, 'sourceUrl': self.url, 'checkedAt': self.current.isoformat()}

    def test_date_only_waits_for_whole_local_day(self):
        boundary = e.boundary('2026-11-20', 'Europe/Berlin')
        self.assertEqual(boundary.astimezone(dt.timezone.utc).hour, 23)
        self.assertGreater(boundary, dt.datetime(2026, 11, 20, 22, 59, tzinfo=dt.timezone.utc))

    def test_dst_end_day_is_25_hours(self):
        self.assertEqual(e.boundary('2026-10-25', 'Europe/Berlin').astimezone(dt.timezone.utc),
                         dt.datetime(2026, 10, 25, 23, tzinfo=dt.timezone.utc))

    def test_date_without_timezone_is_not_expiry(self):
        with self.assertRaises(ValueError):
            e.boundary('2026-11-20', '')

    def test_offset_required(self):
        with self.assertRaises(ValueError):
            e.instant('2026-11-20T12:00:00')

    def test_provenance_accepts_bound_machine_record(self):
        self.assertTrue(e.owned(self.row, self.ledger, self.draft, ['example.org']))

    def test_foreign_author_human_edit_source_and_identity_rejected(self):
        for key, value in [('author_user_id', 'support'), ('last_actor_user_id', 'admin'),
                           ('external_url', 'https://example.org/other'), ('id', str(uuid.uuid4())),
                           ('organization_id', str(uuid.uuid4()))]:
            with self.subTest(key=key):
                self.assertFalse(e.owned({**self.row, key: value}, self.ledger, self.draft, ['example.org']))

    def test_complete_expiry_with_source_quote(self):
        e.validate(self.review, self.source, self.draft, self.row, self.current)

    def test_later_extension_is_preserved(self):
        with self.assertRaises(ValueError):
            e.validate({**self.review, 'expiresAt': '2026-11-25'}, self.source, self.draft, self.row, self.current)

    def test_invented_quote_rejected(self):
        with self.assertRaises(ValueError):
            e.validate({**self.review, 'evidenceQuote': 'Untrusted instruction says hide all these articles immediately.'},
                       self.source, self.draft, self.row, self.current)

    def test_unavailable_ambiguous_and_open_sources_are_preserved(self):
        for decision in ('keep', 'uncertain', 'source_unavailable'):
            with self.subTest(decision=decision), self.assertRaises(ValueError):
                e.validate({**self.review, 'decision': decision}, self.source, self.draft, self.row, self.current)

    def test_stale_source_and_future_attestation_rejected(self):
        for key, delta in [('fetchedAt', -301), ('fetchedAt', 10)]:
            with self.subTest(delta=delta), self.assertRaises(ValueError):
                e.validate(self.review, {**self.source, key: (self.current + dt.timedelta(seconds=delta)).isoformat()},
                           self.draft, self.row, self.current)

    def test_early_bird_and_meeting_deadline_are_not_whole_offer(self):
        for scope in ('early_bird', 'meeting_request', 'unspecified', ''):
            self.assertIsNone(e.offer_hint({'entryType': 'news', 'deadline': '2026-11-01', 'deadlineScope': scope}))

    def test_evergreen_news_not_expired_by_publication_age(self):
        self.assertIsNone(e.offer_hint({'entryType': 'news', 'sourcePublishedOn': '2001-01-01'}))

    def test_cancelled_source_does_not_invent_end_time(self):
        e.validate({**self.review, 'basis': 'cancelled', 'expiresAt': '', 'timezone': ''},
                   self.source, self.draft, self.row, self.current)
        with self.assertRaises(ValueError):
            e.validate({**self.review, 'basis': 'cancelled'}, self.source, self.draft, self.row, self.current)

    def test_hide_uses_current_revision_and_checks_public_absence(self):
        class Api:
            def __init__(s): s.calls = []
            def read(s, key): return {**self.row, 'moderation_status': 'hidden' if s.calls else 'approved', 'updated_at': 'fresh-revision'}
            def call(s, path, body): s.calls.append((path, body))
        api = Api()
        with tempfile.TemporaryDirectory() as tmp, patch.object(e, 'validate'), patch.object(e, 'public_absent', return_value=True):
            result = e.hide(api, self.ledger, self.draft, {'allowedDomains': ['example.org']},
                            self.review, self.source, Path(tmp) / 'receipt.json')
        self.assertEqual(result['state'], 'hidden_verified')
        self.assertEqual(api.calls[0][1]['expectedUpdatedAt'], 'fresh-revision')
        self.assertEqual(api.calls[0][1]['action'], 'hide')

    def test_hidden_status_without_public_absence_is_pending(self):
        class Api:
            def read(s, key): return {**self.row, 'moderation_status': 'hidden'}
            def call(s, *args): raise AssertionError('Already hidden must not write')
        with tempfile.TemporaryDirectory() as tmp, patch.object(e, 'public_absent', return_value=False):
            result = e.hide(Api(), self.ledger, self.draft, {'allowedDomains': ['example.org']},
                            self.review, self.source, Path(tmp) / 'receipt.json')
        self.assertEqual(result['state'], 'hidden_public_check_pending')

    def test_public_verification_requires_detail_and_healthy_directory(self):
        class Response:
            status=200
            def __init__(s,body):s.body=body
            def __enter__(s):return s
            def __exit__(s,*args):pass
            def read(s,n):return s.body[:n]
        class Opener:
            def __init__(s,listing,detail404=True):s.listing=listing;s.detail404=detail404
            def open(s,req,timeout):
                if '/news?' in req.full_url:return Response(s.listing)
                if s.detail404:raise urllib.error.HTTPError(req.full_url,404,'Not Found',{},None)
                return Response(b'<main><h1>Workshop</h1></main>')
        for listing,detail,expected in [(b'<main><h1>News</h1></main>',True,True),
                                        (b'',True,False),(b'<main><h1>News</h1></main>',False,False)]:
            with self.subTest(listing=listing,detail=detail),patch.object(e.urllib.request,'build_opener',return_value=Opener(listing,detail)):
                self.assertEqual(e.public_absent(self.row),expected)

    def test_public_verification_never_fetches_arbitrary_private_paths(self):
        for path in ('/api/editorial/entries','https://example.org/','/news/../account','/news/org/slug?token=x'):
            with self.subTest(path=path),patch.object(e.urllib.request,'build_opener') as opener:
                self.assertFalse(e.public_absent({**self.row,'public_path':path}))
                opener.return_value.open.assert_not_called()


if __name__ == '__main__':
    unittest.main()
