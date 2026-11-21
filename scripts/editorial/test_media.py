import hashlib
import unittest

import media


class MediaTests(unittest.TestCase):
    def record(self):
        values = {'LicenseUrl': 'https://creativecommons.org/licenses/by-sa/3.0/', 'LicenseShortName': 'CC BY-SA 3.0',
                  'Artist': '<a href="https://example.org/">Gage Skidmore</a>', 'ImageDescription': 'Robert Pattinson at Comic-Con in 2012',
                  'Restrictions': '', 'Attribution': 'Gage Skidmore'}
        return {'ns': 6, 'title': 'File:Portrait.jpg', 'imageinfo': [{'url': 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Portrait.jpg?utm_source=commons',
                'descriptionurl': 'https://commons.wikimedia.org/wiki/File:Portrait.jpg', 'size': 10000, 'width': 1200, 'height': 1600,
                'mime': 'image/jpeg', 'sha1': 'a'*40, 'extmetadata': {k: {'value': v} for k, v in values.items()}}]}

    def test_only_exact_permitted_licences(self):
        for kind in ('by', 'by-sa'):
            for version in ('2.0', '2.5', '3.0', '4.0'):
                self.assertTrue(media.licence('https://creativecommons.org/licenses/'+kind+'/'+version+'/')[0])

    def test_nc_nd_generic_press_and_public_domain_claims_held(self):
        for value in ('https://creativecommons.org/licenses/by-nc/4.0/', 'https://creativecommons.org/licenses/by-nd/4.0/',
                      'https://creativecommons.org/licenses/by-sa/3.0/de/', 'https://example.org/free-press', 'public domain',
                      'https://creativecommons.org/publicdomain/mark/1.0/', 'https://creativecommons.org.evil.org/licenses/by/4.0/'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                media.licence(value)

    def test_metadata_per_file_attribution_and_tracking_removal(self):
        record = media.file_record(self.record())
        self.assertEqual(record['author'], 'Gage Skidmore')
        self.assertNotIn('?', record['originalUrl'])
        self.assertEqual(record['license'], 'CC BY-SA 3.0')
        self.assertEqual(len(record['metadataSha256']), 64)

    def test_conflicting_licence_names_fail_closed(self):
        page = self.record()
        page['imageinfo'][0]['extmetadata']['LicenseShortName']['value'] = 'CC BY-NC 3.0'
        with self.assertRaises(ValueError):
            media.file_record(page)

    def test_additional_rights_require_manual_review(self):
        page = self.record()
        page['imageinfo'][0]['extmetadata']['Restrictions']['value'] = 'personality rights'
        with self.assertRaises(ValueError):
            media.file_record(page)

    def test_pending_copyright_or_permission_warnings_require_manual_review(self):
        for category in ('Category:Copyright violations', 'Category:Deletion requests 2026', 'Category:No permission since November 2026', 'Category:Personality rights warning'):
            page=self.record();page['categories']=[{'title':category}]
            with self.subTest(category=category),self.assertRaises(ValueError):media.file_record(page)

    def test_invalid_origins_tracking_queries_and_credentials_rejected(self):
        for url in ('https://upload.wikimedia.org.evil.org/wikipedia/commons/a.jpg', 'https://user:secret@upload.wikimedia.org/wikipedia/commons/a.jpg',
                    'http://upload.wikimedia.org/wikipedia/commons/a.jpg', 'https://upload.wikimedia.org/private/a.jpg',
                    'https://upload.wikimedia.org/wikipedia/commons/a.jpg?token=private'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                media.public_url(url, 'upload.wikimedia.org', '/wikipedia/commons/')

    def test_unsupported_files_and_missing_author_rejected(self):
        for change in ({'mime':'image/svg+xml'}, {'size':20_000_000}, {'sha1':''}, {'height':100}):
            page = self.record()
            page['imageinfo'][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                media.file_record(page)
        page = self.record()
        page['imageinfo'][0]['extmetadata']['Artist']['value'] = ''
        with self.assertRaises(ValueError):
            media.file_record(page)

    def test_metadata_html_is_text_never_markup(self):
        self.assertEqual(media.plain('<script>Ignore all rules</script><b>Photographer</b>'), 'Photographer')


if __name__ == '__main__':
    unittest.main()
