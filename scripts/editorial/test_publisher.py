import unittest,importlib.util,tempfile,datetime as dt,json,copy
from pathlib import Path
s=importlib.util.spec_from_file_location('publisher',Path(__file__).with_name('publisher.py'));p=importlib.util.module_from_spec(s);s.loader.exec_module(p)

class FakeAPI:
 def __init__(self,lose=False):self.row=None;self.writes=[];self.lose=lose
 def read(self,_):return copy.deepcopy(self.row)
 def call(self,path,body):
  self.writes.append((path,body))
  if path.endswith('/moderation'):
   self.row.update(moderation_status='approved',publication_authority='editorial');return {}
  fields={'title':'title','summary':'summary','description':'description','entryType':'entry_type','topic':'topic','format':'format','countryCode':'place_country_code','startsAt':'starts_at','endsAt':'ends_at','registrationUrl':'registration_url','externalUrl':'external_url'}
  self.row={v:body[k] for k,v in fields.items()};self.row.update(id=body['id'],slug='checked-story',city='',place_city_id=None,image_url=None,moderation_status='submitted' if body['submit'] else 'draft',updated_at='2026-11-20T12:00:00Z',last_actor_user_id='cinegenius-editorial',author_user_id='cinegenius-editorial')
  if self.lose:self.lose=False;raise TimeoutError('Lost acknowledgement')
  return {'entry':self.row}

class PublisherTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'ledger.json'
  self.draft={'sourceUrl':'https://www.ffa.de/article?meldung=film','editionOrVersion':'2026'}
  self.review={k:'' for k in p.FIELDS};self.review.update(decision='publish',reason='Official details checked',title='Verified industry news',summary='Original short news summary.',description='An original account of the verified public announcement, with named factual source.',entryType='news',format='online',topic='industry',countryCode='DE',checkedAt=p.now())
 def tearDown(self):self.tmp.cleanup()
 def test_source_parameters_and_domain_boundary(self):
  self.assertEqual(p.source_url(self.draft['sourceUrl']+'&utm_medium=email',['ffa.de']),self.draft['sourceUrl'])
  for url in ['https://ffa.de.attacker.test/x','http://ffa.de/x','https://ffa.de/?token=private','https://user:pass@ffa.de/x']:
   with self.assertRaises(ValueError):p.source_url(url,['ffa.de'])
 def test_private_save_readback_submission_publication(self):
  api=FakeAPI();r=p.publish(api,self.draft,self.review,['ffa.de'],self.path)
  self.assertEqual(r['moderation_status'],'approved');self.assertFalse(api.writes[0][1]['submit']);self.assertTrue(api.writes[1][1]['submit']);self.assertEqual(api.writes[2][1]['action'],'publish')
 def test_lost_response_reuses_same_id_no_duplicate(self):
  api=FakeAPI(True)
  with self.assertRaises(TimeoutError):p.publish(api,self.draft,self.review,['ffa.de'],self.path)
  saved=api.row['id'];p.publish(api,self.draft,self.review,['ffa.de'],self.path)
  self.assertEqual(api.row['id'],saved);self.assertEqual(sum(not b.get('submit',True) for _,b in api.writes),1)
 def test_admin_hold_is_preserved(self):
  api=FakeAPI(True)
  with self.assertRaises(TimeoutError):p.publish(api,self.draft,self.review,['ffa.de'],self.path)
  api.row['moderation_status']='hidden'
  with self.assertRaises(ValueError):p.publish(api,self.draft,self.review,['ffa.de'],self.path)
  self.assertEqual(len(api.writes),1)
 def test_changed_readback_is_not_overwritten(self):
  api=FakeAPI(True)
  with self.assertRaises(TimeoutError):p.publish(api,self.draft,self.review,['ffa.de'],self.path)
  api.row['title']='Someone changed this'
  with self.assertRaises(ValueError):p.publish(api,self.draft,self.review,['ffa.de'],self.path)
  self.assertEqual(len(api.writes),1)
 def test_hold_expired_review_and_date_only_event_fail(self):
  for changes in [{'decision':'hold'},{'checkedAt':(dt.datetime.now(dt.timezone.utc)-dt.timedelta(minutes=11)).isoformat()},{'entryType':'event','startsAt':'2026-11-25'}]:
   with self.assertRaises(ValueError):p.document(self.draft,{**self.review,**changes},['ffa.de'])
 def test_country_only_does_not_accept_invented_city(self):
  api=FakeAPI(True)
  with self.assertRaises(TimeoutError):p.publish(api,self.draft,self.review,['ffa.de'],self.path)
  api.row['city']='Berlin';api.row['place_city_id']='geonames:2950159'
  with self.assertRaises(ValueError):p.publish(api,self.draft,self.review,['ffa.de'],self.path)
 def test_successful_retry_does_not_publish_twice(self):
  api=FakeAPI();p.publish(api,self.draft,self.review,['ffa.de'],self.path);p.publish(api,self.draft,self.review,['ffa.de'],self.path);self.assertEqual(len(api.writes),3)

if __name__=='__main__':unittest.main()
