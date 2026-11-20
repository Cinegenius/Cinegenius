import hashlib
import tempfile
import unittest
from pathlib import Path

import media_bridge as b
import publisher as p


class Response:
    def __init__(self, body, headers=None): self.body, self.headers = body, headers or {}
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, n=-1): return self.body if n < 0 else self.body[:n]


class MediaBridgeTests(unittest.TestCase):
    def test_complete_credit_is_never_silently_truncated(self):
        record = {'author':'Photographer', 'requiredAttribution':'Museum / Donor', 'originalCredit':'Public collection',
                  'title':'Original portrait title', 'protectedUrl':'/api/media/cinegenius-editorial/'+'a'*32+'.jpg',
                  'alt':'Person at a public event', 'caption':'Archive photo from 2012.', 'sourceUrl':'https://commons.wikimedia.org/wiki/File:Portrait.jpg',
                  'license':'CC BY-SA 3.0', 'licenseUrl':'https://creativecommons.org/licenses/by-sa/3.0/', 'changes':'Original unchanged; display may be cropped.'}
        gallery = b.gallery_image(record)
        self.assertEqual(gallery['attribution'], 'Museum / Donor')
        self.assertEqual(gallery['credit'], 'Public collection')
        self.assertEqual(gallery['imageTitle'], record['title'])
        self.assertIn('Archive', gallery['caption'])
        with self.assertRaises(ValueError): b.gallery_image({**record,'requiredAttribution':'x'*1001})

    def api(self, body, headers=None):
        api = object.__new__(p.API)
        api.token = 'not-a-real-credential'
        class Opener:
            def open(self, req, timeout):
                self.request = req
                return Response(body, headers)
        api.opener = Opener()
        return api

    def test_upload_checks_actual_original_bytes_after_ai_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'photo.jpg';path.write_bytes(b'original')
            api = self.api(b'{}')
            with self.assertRaises(ValueError): api.upload(path,'entry','0'*64,'image/jpeg')

    def test_stable_retry_upload_id_and_owned_protected_origin(self):
        data=b'original';digest=hashlib.sha256(data).hexdigest()
        url='/api/media/cinegenius-editorial/'+'a'*32+'.jpg'
        api = self.api(('{"url":"'+url+'"}').encode())
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'photo.jpg';path.write_bytes(data)
            self.assertEqual(api.upload(path,'entry',digest,'image/jpeg'), url)
            self.assertIn(hashlib.sha256(('entry:'+digest).encode()).hexdigest()[:32].encode(),api.opener.request.data)
            self.assertNotIn(b'not-a-real-credential', api.opener.request.data)
        bad=self.api(b'{"url":"https://example.org/photo.jpg"}')
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'photo.jpg';path.write_bytes(data)
            with self.assertRaises(ValueError): bad.upload(path,'entry',digest,'image/jpeg')

    def test_readback_checks_both_header_and_actual_original_digest(self):
        data=b'original';digest=hashlib.sha256(data).hexdigest()
        self.api(data, {'X-Content-SHA256':digest}).verify_media('entry','/api/media/x',digest)
        for actual,header in ((b'changed',digest),(data,'0'*64)):
            with self.assertRaises(ValueError):
                self.api(actual,{'X-Content-SHA256':header}).verify_media('entry','/api/media/x',digest)

    def test_image_and_credit_readback_differences_block_publication(self):
        doc={'imageUrl':'/api/media/a','imageGallery':[{'caption':'Archive 2012'}]}
        row={'image_url':'/api/media/a','image_gallery':[{'caption':'Archive 2012'}]}
        self.assertTrue(p.matches(row,doc))
        self.assertFalse(p.matches({**row,'image_gallery':[]},doc))
        self.assertFalse(p.matches({**row,'image_url':None},doc))


if __name__ == '__main__':unittest.main()
