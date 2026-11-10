"""Small offline repo tests; generated ZIP/input/output fixtures are auto-cleaned."""
from pathlib import Path
import copy,importlib.util,json,shutil,subprocess,sys,tempfile,unittest,zipfile
ROOT=Path(__file__).resolve().parents[2]
SCRIPTS=ROOT/'scripts'
spec=importlib.util.spec_from_file_location('place_locale_overlay',SCRIPTS/'place_locale_overlay.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
def row(name='Current',locale='nl',identifier='1',preferred='',short='',colloquial='',historic='',start='',end='',alt='1'):
 return [alt,identifier,locale,name,preferred,short,colloquial,historic,start,end]
def select(rows):
 collector=module.CurrentNameCollector({'1'},'2026-11-10')
 for value in rows:collector.consider(value)
 return collector.finish()
def tiny():
 return {'countries':['DE'],'cities':[{'id':'geonames:1','name':'Primary','country':'DE','region':'DE:geonames:2','district':'','aliases':['Primary','Old alias'],'names':{'de':'Deutsch','en':'English'}}],'regions':[{'id':'DE:geonames:2','name':'State','code':'DE.01','country':'DE','aliases':['State'],'names':{'de':'Land'}}],'districts':[]}
class SelectionTests(unittest.TestCase):
 def test_preferred_current_outranks_other_valid_candidates(self):
  names,report=select([row('Alternative',alt='2'),row('Preferred',preferred='1')]);self.assertEqual(names[('1','nl')],'Preferred');self.assertEqual(names[('1','nl-BE')],'Preferred');self.assertEqual(report['provenance'][0]['basis'],'preferred_current')
 def test_unique_current_name_without_preferred_flag_is_not_an_arbitrary_pick(self):
  names,report=select([row('Bryssel',locale='sv')]);self.assertEqual(names[('1','sv')],'Bryssel');self.assertEqual(report['provenance'][0]['basis'],'unique_current')
 def test_ambiguous_names_are_not_selected(self):
  for preferred in ['','1']:
   names,report=select([row('One',preferred=preferred),row('Two',preferred=preferred,alt='2')]);self.assertNotIn(('1','nl'),names);self.assertEqual(len(report['ambiguous']),1)
 def test_duplicate_identical_labels_are_unambiguous_and_deterministic(self):
  values=[row('Same',alt='8'),row('Same',alt='2')];a,ra=select(values);b,rb=select(values[::-1]);self.assertEqual(a,b);self.assertEqual(ra['provenance'],rb['provenance']);self.assertEqual(ra['provenance'][0]['alternateNameId'],'2')
 def test_short_historic_colloquial_ended_future_unclear_are_excluded(self):
  cases=[row('Short',short='1'),row('Old',historic='1'),row('Slang',colloquial='1'),row('Ended',end='2025'),row('Future',start='2027'),row('Unclear',start='ca. 2020'),row('Broken\x00')]
  for value in cases:
   names,report=select([value]);self.assertFalse(names);self.assertEqual(len(report['rejected']),1)
 def test_dates_and_v2_fields(self):
  names,_=select([row(start='2026-11-10')]);self.assertIn(('1','nl'),names)
  for value in [row(start='2026-11-11'),row(start='2026-02-30'),row()[:8]]:self.assertFalse(select([value])[0])
 def test_native_belgian_variant_beats_nl_and_never_uses_west_flemish(self):
  names,report=select([row('Dutch'),row('Belgian Dutch',locale='nl-BE',alt='2'),row('West Flemish',locale='vls',alt='3')]);self.assertEqual(names[('1','nl-BE')],'Belgian Dutch');self.assertEqual(report['counts']['excluded_vls'],1)
 def test_ambiguous_belgian_variant_uses_verified_native_nl(self):
  names,report=select([row('Dutch'),row('Belgian one',locale='nl-BE',alt='2'),row('Belgian two',locale='nl-BE',alt='3')]);self.assertEqual(names[('1','nl-BE')],'Dutch');self.assertEqual(report['ambiguous'][0]['locale'],'nl-BE')
 def test_exact_ids_only(self):
  self.assertFalse(select([row('Same primary name',identifier='999')])[0])
 def test_overlay_is_additive_idempotent_and_adds_saveable_alias(self):
  base=tiny();overlay,conflicts=module.build_overlay(base,{('1','nl'):'Nieuw',('1','nl-BE'):'Nieuw',('2','sv'):'Region'});out=module.apply_overlay(base,overlay);self.assertEqual(conflicts,[]);self.assertEqual(out,module.apply_overlay(out,overlay));self.assertEqual(base,tiny());self.assertEqual(out['cities'][0]['name'],'Primary');self.assertEqual(out['cities'][0]['names']['de'],'Deutsch');self.assertEqual(out['cities'][0]['aliases'],['Primary','Old alias','Nieuw']);self.assertIn('Region',out['regions'][0]['aliases'])
 def test_existing_new_locale_conflicts_are_preserved_and_reported(self):
  base=tiny();base['cities'][0]['names']['nl']='Already chosen';overlay,conflicts=module.build_overlay(base,{('1','nl'):'Other'});self.assertEqual(len(conflicts),1);self.assertFalse(overlay['changes']['cities']);self.assertEqual(module.apply_overlay(base,overlay),base)
 def test_apply_rejects_unrelated_changes_unknown_ids_and_legacy_locale_edits(self):
  base=tiny();overlay,_=module.build_overlay(base,{('1','nl'):'Nieuw'})
  modified=copy.deepcopy(base);modified['cities'][0]['country']='FR'
  with self.assertRaises(ValueError):module.apply_overlay(modified,overlay)
  unknown=copy.deepcopy(overlay);unknown['changes']['cities']['geonames:999']={'names':{'nl':'No'}}
  with self.assertRaises(ValueError):module.apply_overlay(base,unknown)
  bad=copy.deepcopy(overlay);bad['changes']['cities']['geonames:1']['names']['de']='Overwrite';bad['baseInvariantSha256']=module.invariant_fingerprint(base,bad['changes'])
  with self.assertRaises(ValueError):module.apply_overlay(base,bad)
class ImporterTests(unittest.TestCase):
 def test_mini_full_import_keeps_six_fixed_legacy_labels_and_adds_native_current_names(self):
  # No fixed temporary path or external export: all fixtures are created here and cleaned.
  with tempfile.TemporaryDirectory(prefix='.place-locale-test-',dir=Path(__file__).parent) as temporary:
   root=Path(temporary);inputs=root/'inputs';inputs.mkdir()
   (inputs/'countries.txt').write_text('DE\tGermany\n',encoding='utf-8')
   (inputs/'regions.txt').write_text('DE.01\tState\tState\t100\n',encoding='utf-8')
   (inputs/'districts.txt').write_text('DE.01.001\tDistrict\tDistrict\t200\n',encoding='utf-8')
   geo=['300','Alpha','Alpha','Original alias','0','0','P','PPL','DE','','01','001','','','20000','','','UTC','2026-11-09']
   with zipfile.ZipFile(inputs/'cities.zip','w') as archive:archive.writestr('cities15000.txt','\t'.join(geo)+'\n')
   legacy={'de':'Old German','en':'Old English','es':'Español anterior','it':'Italiano precedente','cs':'Původní čeština','hu':'Régi magyar'}
   names=[row(name,locale=locale,identifier='300',alt=str(i+10)) for i,(locale,name) in enumerate(legacy.items())]
   names += [row('Short German',locale='de',identifier='300',preferred='1',short='1',alt='20'),row('Nieuw',identifier='300',preferred='1',alt='21'),row('Ny',locale='sv',identifier='300',alt='22'),row('West Flemish',locale='vls',identifier='300',alt='23'),row('Short Dutch',identifier='300',preferred='1',short='1',alt='24'),row('Old Dutch',identifier='300',preferred='1',historic='1',alt='25'),row('Provincie Nieuw',identifier='100',preferred='1',alt='30'),row('Ny region',identifier='100',locale='sv',alt='31'),row('Nieuw district',identifier='200',preferred='1',alt='40'),row('Nytt distrikt',identifier='200',locale='sv',alt='41')]
   with zipfile.ZipFile(inputs/'names.zip','w') as archive:archive.writestr('alternateNamesV2.txt','\n'.join('\t'.join(fields) for fields in names)+'\n')
   target=root/'builder';(target/'scripts').mkdir(parents=True);(target/'lib/places').mkdir(parents=True)
   for name in ['build-place-catalog.py','place_locale_overlay.py']:shutil.copy2(SCRIPTS/name,target/'scripts'/name)
   subprocess.run([sys.executable,str(target/'scripts/build-place-catalog.py'),str(inputs),'--as-of','2026-11-10'],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   catalog=json.loads((target/'lib/places/catalog.json').read_text(encoding='utf-8'))
   self.assertEqual(catalog['countries'],['DE']);self.assertEqual([len(catalog[k]) for k in module.KINDS],[1,1,1])
   city=catalog['cities'][0]
   self.assertEqual({k:city[k] for k in ['id','name','country','region','district']},{'id':'geonames:300','name':'Alpha','country':'DE','region':'DE:geonames:100','district':'geonames:200'})
   expected={**legacy,'de':'Short German','nl':'Nieuw','nl-BE':'Nieuw','sv':'Ny'}
   self.assertEqual(city['names'],expected)
   for name in ['Original alias','Alpha',*expected.values()]:self.assertIn(name,city['aliases'])
   for name in ['West Flemish','Short Dutch','Old Dutch']:self.assertNotIn(name,city['aliases'])
   region=catalog['regions'][0];district=catalog['districts'][0]
   self.assertEqual(region['id'],'DE:geonames:100');self.assertEqual(region['name'],'State')
   self.assertEqual(region['names'],{'nl':'Provincie Nieuw','nl-BE':'Provincie Nieuw','sv':'Ny region'})
   for name in region['names'].values():self.assertIn(name,region['aliases'])
   self.assertEqual(district['id'],'geonames:200');self.assertEqual(district['name'],'District')
   self.assertEqual(district['names'],{'nl':'Nieuw district','nl-BE':'Nieuw district','sv':'Nytt distrikt'})
   metadata=json.loads((target/'lib/places/source.json').read_text(encoding='utf-8'))
   self.assertEqual(metadata['snapshot'],'2026-11-10');self.assertEqual(metadata['additionalNameLocales'],list(module.LOCALES));self.assertEqual(metadata['additionalNameSelectionCounts']['excluded_vls'],1)
   self.assertEqual(set(metadata['inputSha256']),{'countries.txt','regions.txt','districts.txt','cities.zip','names.zip'})
if __name__=='__main__':unittest.main()
