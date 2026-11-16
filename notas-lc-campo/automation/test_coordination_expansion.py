import copy,gzip,hashlib,json,shutil,tempfile,unittest
from collections import Counter
from pathlib import Path
from unittest.mock import patch
import build

ROOT=Path(__file__).resolve().parents[2]
class ExpansionTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  shutil.copytree(ROOT/'notas-lc-campo',self.root/'notas-lc-campo')
  self.app=self.root/'notas-lc-campo'
  self.data=json.load(gzip.open(self.app/'notes.json.gz','rt'))
  self.input=self.root/'new.gz'
 def tearDown(self):self.tmp.cleanup()
 def write(self):
  with gzip.open(self.input,'wt',encoding='utf-8') as f:json.dump(self.data,f,ensure_ascii=False,separators=(',',':'))
 def reject(self):
  self.write();before=(self.app/'notes.json.gz').read_bytes()
  with self.assertRaises(ValueError):build.processar(self.input,self.root)
  self.assertEqual(before,(self.app/'notes.json.gz').read_bytes())
 def test_missing_coordination_rejected_below_global_threshold(self):
  rows=self.data['abas'][0]['linhas'];small=min(Counter(r[0] for r in rows),key=Counter(r[0] for r in rows).get)
  self.data['abas'][0]['linhas']=[r for r in rows if r[0]!=small];self.reject()
 def test_partial_coordination_rejected(self):
  rows=self.data['abas'][0]['linhas'];small=min(Counter(r[0] for r in rows),key=Counter(r[0] for r in rows).get)
  kept=False;new=[]
  for r in rows:
   if r[0]!=small or not kept:new.append(r)
   if r[0]==small:kept=True
  self.data['abas'][0]['linhas']=new;self.reject()
 def test_unknown_center_rejected(self):
  self.data['abas'][0]['linhas'][0][0]='OUTRO';self.reject()
 def test_normalized_duplicate_rejected(self):
  rows=self.data['abas'][0]['linhas'];rows[1][2]='0'+rows[0][2];self.reject()
 def test_expansion_only_exact_snapshot(self):
  policy=json.loads(Path(build.__file__).with_name('coordination-policy.json').read_text())
  # Check exception against the approved historical snapshot only while it is the current test fixture.
  rows=self.data['abas'][0]['linhas']
  digest=hashlib.sha256(json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
  if digest!=policy['expansion']['rows_sha256']:self.skipTest('Approved snapshot is no longer current')
  old=copy.deepcopy(self.data);old['abas'][0]['linhas']=[r for r in rows if r[0] not in ('FBR','FBV')]
  with gzip.open(self.app/'notes.json.gz','wt',encoding='utf-8') as f:json.dump(old,f)
  status=json.loads((self.app/'base-status.json').read_text());status['total']=len(old['abas'][0]['linhas']);(self.app/'base-status.json').write_text(json.dumps(status))
  self.write();build.processar(self.input,self.root)
  self.assertTrue(json.loads((self.app/'base-status.json').read_text())['expansion_applied'])
  # Same totals and date cannot authorize a changed note.
  with gzip.open(self.app/'notes.json.gz','wt',encoding='utf-8') as f:json.dump(old,f)
  (self.app/'base-status.json').write_text(json.dumps(status))
  self.data['abas'][0]['linhas'][0][6]+=' tampered';self.reject()
 def test_future_large_growth_still_rejected(self):
  self.data['abas'][0]['linhas']+=[]
  rows=self.data['abas'][0]['linhas']
  extra=copy.deepcopy(rows[:len(rows)//2])
  for i,r in enumerate(extra):r[2]=str(900000000+i)
  rows.extend(extra);self.reject()
