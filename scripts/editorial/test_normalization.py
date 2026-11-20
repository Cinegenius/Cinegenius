import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import media


@unittest.skipUnless(Path('/srv/cinegenius/releases/20261118-profile-art/node_modules/sharp').exists(), 'Real server Sharp required')
class NormalizationTests(unittest.TestCase):
    def fixture(self, directory, large=False):
        path=Path(directory)/'input.png'
        script='''const sharp=require('/srv/cinegenius/releases/20261118-profile-art/node_modules/sharp');
const crypto=require('node:crypto');const fs=require('node:fs');
(async()=>{const n=process.argv[2]==='large'?1400:800;
const image=process.argv[2]==='large'?sharp(crypto.randomBytes(n*n*3),{raw:{width:n,height:n,channels:3}}):sharp({create:{width:n,height:600,channels:3,background:'#426b84'}});
fs.writeFileSync(process.argv[1],await image.png().toBuffer());})();'''
        subprocess.run(['/usr/bin/node','-e',script,str(path),'large' if large else 'small'],check=True,timeout=20)
        raw=path.read_bytes()
        return {'localPath':str(path),'mime':'image/png','sha256':hashlib.sha256(raw).hexdigest()},raw

    def test_small_source_kept_and_expected_inert_webp_independently_prepared(self):
        with tempfile.TemporaryDirectory() as tmp:
            record,original=self.fixture(tmp)
            result=media.normalize(record)
            self.assertEqual(Path(result['localPath']).read_bytes(),original)
            self.assertEqual(result['uploadSha256'],record['sha256'])
            derivative=Path(result['publishedPath']).read_bytes()
            self.assertEqual(derivative[8:12],b'WEBP')
            self.assertEqual(hashlib.sha256(derivative).hexdigest(),result['publishedSha256'])
            self.assertNotEqual(result['publishedSha256'],record['sha256'])
            self.assertIn('metadata removed',result['changes'])
            self.assertEqual(result['normalization']['recipe'],'upload-guard-webp-v1')

    def test_large_original_survives_with_bounded_upload_and_final_preview(self):
        with tempfile.TemporaryDirectory() as tmp:
            record,original=self.fixture(tmp,large=True)
            self.assertGreater(len(original),4*1024*1024)
            result=media.normalize(record)
            self.assertEqual(Path(result['localPath']).read_bytes(),original)
            self.assertNotEqual(result['uploadPath'],result['localPath'])
            self.assertLessEqual(Path(result['uploadPath']).stat().st_size,4*1024*1024)
            self.assertEqual(result['uploadMime'],'image/webp')
            self.assertEqual(hashlib.sha256(Path(result['publishedPath']).read_bytes()).hexdigest(),result['publishedSha256'])

    def test_changed_input_is_rejected_before_derivative_creation(self):
        with tempfile.TemporaryDirectory() as tmp:
            record,_=self.fixture(tmp)
            with self.assertRaises(ValueError):media.normalize({**record,'sha256':'0'*64})


if __name__=='__main__':unittest.main()
