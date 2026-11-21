import datetime as dt
import tempfile
import unittest
import uuid
from pathlib import Path

import feedback as f


class FeedbackTests(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime(2026, 11, 21, 12, tzinfo=dt.timezone.utc)
        self.feed = {'contract':'news-readership-v1','coverage':'consenting_visits_only','metric':'observations_not_people',
                     'status':'cold_start','thresholds':{'impressions':20,'views':5,'minimumAgeHours':48},
                     'window':{'from':'2026-10-24T00:00:00.000Z','until':'2026-11-21T00:00:00.000Z','timeZone':'UTC'}, 'entries':[]}
    def rows(self):
        return [{'id':str(uuid.uuid4()),'topic':topic,'state':'ready','learningEligible':True,'impressions':100,'views':views}
                for topic, views in [('industry',50)]*3+[('education',10)]*3]
    def test_no_data_never_fabricates_popularity(self):
        out=f.analyse(self.feed,self.now)
        self.assertEqual(out['status'],'cold_start');self.assertEqual(out['topicWeights'],{})
    def test_one_popular_title_cannot_steer_selection(self):
        out=f.analyse({**self.feed,'entries':self.rows()[:1]},self.now)
        self.assertEqual(out['topicWeights'],{})
    def test_sufficient_comparison_has_at_most_ten_percent_weight_change(self):
        out=f.analyse({**self.feed,'entries':self.rows()},self.now)
        self.assertEqual(out['status'],'ready');self.assertEqual(out['eligibleArticles'],6)
        self.assertTrue(all(.9<=v<=1.1 for v in out['topicWeights'].values()))
        self.assertTrue(out['limits']['noAutomaticRemoval'])
    def test_hidden_suppressed_metrics_are_not_treated_as_zero(self):
        rows=[{**r,'views':None} for r in self.rows()]
        self.assertFalse(f.analyse({**self.feed,'entries':rows},self.now)['topicWeights'])
    def test_unmatched_opens_above_impressions_are_not_click_through(self):
        rows=[{**r,'views':1000} for r in self.rows()]
        self.assertFalse(f.analyse({**self.feed,'entries':rows},self.now)['topicWeights'])
    def test_unsupported_unconsented_or_people_metrics_rejected(self):
        for change in ({'metric':'people'},{'coverage':'all_members'},{'contract':'unknown'}, {'status':'unavailable'}):
            with self.subTest(change=change),self.assertRaises(ValueError):f.analyse({**self.feed,**change},self.now)
    def test_stale_window_and_weaker_threshold_rejected(self):
        with self.assertRaises(ValueError):f.analyse(self.feed,self.now+dt.timedelta(days=4))
        with self.assertRaises(ValueError):f.analyse({**self.feed,'thresholds':{'impressions':1,'views':1,'minimumAgeHours':0}},self.now)
    def test_duplicate_or_fake_article_rows_rejected(self):
        row=self.rows()[0]
        for rows in ([row,row],[{**row,'id':'member-private-id'}]):
            with self.assertRaises(ValueError):f.analyse({**self.feed,'entries':rows},self.now)
    def test_research_receives_no_article_or_person_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);out=f.analyse({**self.feed,'entries':self.rows()},self.now)
            f.pub.atomic(root/'context/news-readership.json',{**out,'checkedAt':self.now.isoformat(),'privateUnexpected':'secret'})
            context=f.research_context(root,self.now)
            self.assertEqual(context['status'],'ready');self.assertNotIn('privateUnexpected',context)
            self.assertNotIn('eligibleTopics',context);self.assertNotIn('entries',context)
            self.assertEqual(f.research_context(root,self.now+dt.timedelta(days=2))['topicWeights'],{})


if __name__=='__main__':unittest.main()
