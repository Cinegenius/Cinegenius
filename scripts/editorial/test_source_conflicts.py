"""Publication regression for conflicting MeetMarket VAT sources. No live I/O."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import publisher
import research
from test_publisher import FakeAPI


class SourceConflictTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.root_patch = patch.object(publisher, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.domains = ['sheffdocfest.com', 'agdok.de']
        self.group = {'id': 'ag-dok', 'allowedDomains': self.domains}
        self.primary = 'https://www.sheffdocfest.com/meetmarket-entries'
        self.guidelines = 'https://www.sheffdocfest.com/meetmarket-application-guidelines'
        self.conflict = 'Entry page: £30 including VAT; application guidelines: £30 excluding VAT.'
        self.draft = {
            'sourceUrl': self.primary, 'editionOrVersion': 'MeetMarket 2027',
            'confirmationUrls': [self.guidelines],
            'rightsNote': 'Own reporting. ' + self.conflict + ' Omit numerical fee.',
            'sourceConflicts': [self.conflict],
            'description': 'Fees apply; consult the official guidelines before payment.',
        }
        self.review = {key: '' for key in publisher.FIELDS}
        self.review.update(
            decision='publish', reason='Entry page checked', checkedAt=publisher.now(),
            title='MeetMarket applications remain open', summary='Applications are open until 25 January.',
            description='Sheffield DocFest says entries cost £30 including VAT. Apply by 25 January 2027.',
            entryType='news', topic='industry', format='online', countryCode='GB',
            sourceConflicts=[],
        )

    def test_known_conflict_blocks_reviewer_and_all_product_activity(self):
        # The rewritten review repeats the actual incident. A publish verdict
        # must not erase the earlier warning or trigger even a private save.
        api = MagicMock()
        with patch.object(publisher, 'fetch_source') as fetch, patch.object(publisher.subprocess, 'Popen') as model:
            with self.assertRaisesRegex(ValueError, 'Unresolved source conflicts'):
                publisher.verify(self.draft, self.group, self.root)
            fetch.assert_not_called()
            model.assert_not_called()
        with self.assertRaisesRegex(ValueError, 'Unresolved source conflicts'):
            publisher.publish(api, self.draft, self.review, self.domains, self.root/'ledger.json')
        self.assertEqual(api.mock_calls, [])
        self.assertFalse((self.root/'ledger.json').exists())

    def test_legacy_candidate_is_not_implicitly_declared_conflict_free(self):
        legacy = {k: v for k, v in self.draft.items() if k != 'sourceConflicts'}
        before = copy.deepcopy(legacy)
        with self.assertRaisesRegex(ValueError, 'fresh source review required'):
            publisher.document(legacy, self.review, self.domains)
        self.assertEqual(legacy, before)

    def test_independent_review_conflict_overrides_its_publish_verdict(self):
        draft = {**self.draft, 'sourceConflicts': []}
        api = MagicMock()
        with self.assertRaisesRegex(ValueError, 'Unresolved source conflicts'):
            publisher.publish(api, draft, {**self.review, 'sourceConflicts': [self.conflict]}, self.domains, self.root/'ledger.json')
        self.assertEqual(api.mock_calls, [])

    def test_missing_or_malformed_checks_fail_closed_on_both_sides(self):
        for value in (None, False, '', {}, [''], [False], ['x'*1001], ['x']*7):
            with self.subTest(value=repr(value)[:30]):
                with self.assertRaises(ValueError):
                    publisher.document({**self.draft, 'sourceConflicts': value}, self.review, self.domains)
                with self.assertRaises(ValueError):
                    publisher.document({**self.draft, 'sourceConflicts': []}, {**self.review, 'sourceConflicts': value}, self.domains)
        with self.assertRaises(ValueError):
            publisher.document({**self.draft, 'sourceConflicts': []}, {k:v for k,v in self.review.items() if k!='sourceConflicts'}, self.domains)

    def test_every_confirmation_and_warning_reaches_independent_review(self):
        draft = {**self.draft, 'sourceConflicts': [], 'confirmationUrls': [self.guidelines, self.primary, self.guidelines]}
        def fetch(url, _):
            return {'url': url, 'fetchedAt': publisher.now(), 'sha256': 'a'*64,
                    'text': '£30 including VAT' if url == self.primary else '£30 excluding VAT'}
        with patch.object(publisher, 'fetch_source', side_effect=fetch) as fetcher:
            prompt = publisher.review_prompt(draft, self.group, self.root)
        self.assertEqual(fetcher.call_count, 2)
        for text in (self.primary, self.guidelines, draft['rightsNote'], '£30 including VAT', '£30 excluding VAT'):
            self.assertIn(text, prompt)
        self.assertEqual(len(json.loads((self.root/'sources.json').read_text())), 2)

    def test_unavailable_confirmation_is_explicit_not_discarded(self):
        def fetch(url, _):
            if url == self.guidelines: raise OSError('unavailable')
            return {'url': url, 'text': 'Source text', 'fetchedAt': publisher.now(), 'sha256': 'a'*64}
        with patch.object(publisher, 'fetch_source', side_effect=fetch):
            prompt = publisher.review_prompt({**self.draft, 'sourceConflicts': []}, self.group, self.root)
        evidence = json.loads((self.root/'sources.json').read_text())
        self.assertEqual(evidence[1], {'url': self.guidelines, 'status': 'fetch_unavailable', 'requiresIndependentBrowsing': True})
        self.assertIn('fetch_unavailable', prompt)

    def test_invalid_unapproved_or_blocked_confirmation_prevents_review(self):
        for confirmations in (None, 'https://example.org', ['https://attacker.test/'], ['https://sheffdocfest.com/?token=private'], [self.primary]*7):
            with patch.object(publisher, 'fetch_source') as fetcher:
                with self.assertRaises(ValueError):
                    publisher.review_prompt({**self.draft, 'sourceConflicts': [], 'confirmationUrls': confirmations}, self.group, self.root)
                fetcher.assert_not_called()
        with patch.object(publisher, 'fetch_source', side_effect=publisher.SourcePolicyError('blocked')):
            with self.assertRaises(publisher.SourcePolicyError):
                publisher.review_prompt({**self.draft, 'sourceConflicts': []}, self.group, self.root)

    def test_incomplete_evidence_is_not_silently_truncated(self):
        for note in (None, False, 'x'*1001):
            with self.assertRaises(ValueError):
                publisher.document({**self.draft, 'sourceConflicts': [], 'rightsNote': note}, self.review, self.domains)

    def test_conflict_free_verified_candidate_still_publishes(self):
        draft = {**self.draft, 'sourceConflicts': [], 'rightsNote': 'Own writing; no copied media.'}
        review = {**self.review, 'description': 'The organizer confirms applications remain open until 25 January 2027. Fees apply.'}
        api = FakeAPI()
        result = publisher.publish(api, draft, review, self.domains, self.root/'ledger.json')
        self.assertEqual(result['moderation_status'], 'approved')
        self.assertEqual(len(api.writes), 3)
        self.assertNotIn('sourceConflicts', api.writes[0][1])

    def research_result(self):
        return {
            'checks': [{'groupId': 'ag-dok', 'status': 'checked', 'checkedUrls': [self.primary], 'note': 'Official detail checked'}],
            'drafts': [{**self.draft, 'groupId': 'ag-dok', 'title': 'MeetMarket call',
                        'summary': 'A current documentary call.', 'description': 'A public documentary project application remains open.',
                        'countryCodes': ['GB'], 'sourcePublishedOn': None, 'eventStart': None, 'eventEnd': None, 'deadline': None}],
            'expiryCandidates': [], 'notes': [],
        }

    def test_research_retains_conflicts_for_private_editorial_correction(self):
        data = research.validate(self.research_result(), [self.group])
        self.assertEqual(data['drafts'][0]['sourceConflicts'], [self.conflict])
        self.assertEqual(data['checks'][0]['status'], 'checked')

    def test_research_without_conflict_check_cannot_advance_success(self):
        data = self.research_result()
        del data['drafts'][0]['sourceConflicts']
        result = research.validate(data, [self.group])
        self.assertEqual(result['drafts'], [])
        self.assertEqual(result['checks'][0]['status'], 'error')


if __name__ == '__main__':
    unittest.main()
