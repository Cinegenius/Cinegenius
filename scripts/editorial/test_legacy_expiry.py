import datetime as dt
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import legacy_expiry as l


class LegacyTests(unittest.TestCase):
    def setUp(self):
        self.id='bc294b1e-3bbd-4aed-8b4e-801cc168f2b5'
        self.ref={'entryId':self.id,'organizationId':'b595781d-aeeb-4807-93c7-ec58334a329e','groupId':'ag-dok',
                  'sourceUrl':'https://agdok.de/akademie/example/','title':'Workshop',
                  'publicUrl':'https://www.cinegenius.co/news/ag-dok/workshop','evidenceSha256':'a'*64}
        self.grant={'id':self.id,'organizationId':self.ref['organizationId'],'sourceUrl':self.ref['sourceUrl'],
                    'evidenceSha256':'a'*64,'expectedUpdatedAt':'2026-11-20T10:00:00Z',
                    'contentExpiresAt':'2026-11-20T16:00:00Z','validUntil':(dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=1)).isoformat()}

    def api(self,response):
        class API:
            def call(s,path,body=None):
                if body is not None:raise AssertionError('Must not write without a precise grant')
                return response
        return API()

    def test_no_grant_never_adopts_human_authorship(self):
        self.assertIsNone(l.grant_for(self.api({'grants':[]}),self.ref))

    def test_provenance_source_org_and_revision_entitlement_bindings(self):
        for change in ({'sourceUrl':'https://agdok.de/other'},{'organizationId':'another-org'},{'evidenceSha256':'b'*64}):
            with self.subTest(change=change),self.assertRaises(ValueError):
                l.grant_for(self.api({'grants':[{**self.grant,**change}]}),self.ref)

    def test_current_precise_grant_is_accepted_without_general_publishing_grant(self):
        self.assertEqual(l.grant_for(self.api({'grants':[self.grant]}),self.ref),self.grant)

    def test_expired_or_partial_grants_fail_closed(self):
        with self.assertRaises(ValueError):l.grant_for(self.api({'grants':[self.grant],'truncated':True}),self.ref)
        with self.assertRaises(ValueError):l.grant_for(self.api({'grants':[{**self.grant,'validUntil':'2001-01-01T00:00:00Z'}]}),self.ref)

    def test_exact_private_provenance_hash_and_id_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'expiry').mkdir();folder=root/'context/legacy-provenance';folder.mkdir(parents=True)
            p=folder/(self.id+'.json');p.write_text(json.dumps({'entry':{'entry_id':self.id,'source_url':self.ref['sourceUrl'],'title':'Workshop'}}))
            ref={**self.ref,'evidenceSha256':hashlib.sha256(p.read_bytes()).hexdigest()}
            (root/'expiry/legacy-imports.json').write_text(json.dumps([ref]))
            self.assertEqual(l.load_records(root)[0]['publicPath'],'/news/ag-dok/workshop')
            p.write_text(p.read_text()+' ')
            with self.assertRaises(ValueError):l.load_records(root)

    def test_already_hidden_entry_is_only_read_and_publicly_verified(self):
        ref={**self.ref,'provenance':{'ends_local':'2026-11-20T17:00:00+01:00'},'publicPath':'/news/ag-dok/workshop'}
        response={'grants':[],'entry':{'id':self.id,'currentStatus':'hidden','usedAt':'2026-11-20T17:05:00Z'}}
        with patch.object(l.expiry,'public_absent',return_value=True):
            result=l.maintain_one(self.api(response),ref,{},Path('/unused'),Path('/unused'))
        self.assertEqual(result['state'],'already_hidden_verified');self.assertEqual(result['hidden'],0)

    def test_missing_or_revoked_grant_is_reported_without_post(self):
        ref={**self.ref,'provenance':{'ends_local':'2026-11-20T17:00:00+01:00'},'publicPath':'/news/ag-dok/workshop'}
        result=l.maintain_one(self.api({'grants':[],'entry':{'id':self.id,'currentStatus':'approved'}}),ref,{},Path('/unused'),Path('/unused'))
        self.assertEqual(result['state'],'legacy_admin_grant_required')


if __name__=='__main__':unittest.main()
