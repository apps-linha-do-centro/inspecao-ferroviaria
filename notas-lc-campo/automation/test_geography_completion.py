import collections,gzip,hashlib,json,struct,unittest
from pathlib import Path
from complete_geography import complete,key,point_index
APP=Path(__file__).resolve().parents[1]
class CompleteGeographyTest(unittest.TestCase):
 def test_all_audited_source_groups_preserved(self):
  report=json.loads((APP/'automation/geography-completion.json').read_text());tracks=json.loads((APP/'tracks.json').read_text());binary=gzip.decompress((APP/'rail.bin.gz').read_bytes());completed_count=report['original_segments']+sum(report['added_points'].values());binary=binary[:completed_count*28];tracks=tracks[:max(r[6] for r in struct.iter_unpack('<7i',binary))+1];actual=point_index(tracks,binary)
  self.assertEqual(hashlib.sha256(binary).hexdigest(),report['binary_sha256']);self.assertEqual(hashlib.sha256(json.dumps(tracks,ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),report['tracks_sha256'])
  self.assertEqual(hashlib.sha256(binary[:report['original_segments']*28]).hexdigest(),report['preserved_binary_prefix_sha256'])
  self.assertEqual(hashlib.sha256(json.dumps(tracks[:report['original_tracks']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),report['preserved_tracks_prefix_sha256'])
  self.assertEqual(sum(report['source_records'].values()),153097);self.assertEqual(sum(report['unique_source_points'].values()),153093)
  self.assertEqual(sum(report['unrepresented_source_records'].values()),0)
  for group in report['groups']:
   points=actual[key(group['metadata'])];self.assertEqual(len(points),group['app_points']);self.assertGreaterEqual(len(points),group['source_points']);self.assertEqual(hashlib.sha256(b''.join(struct.pack('<3i',*p) for p in sorted(points))).hexdigest(),group['app_points_sha256'])
  added=list(struct.iter_unpack('<7i',binary[report['original_segments']*28:]));self.assertEqual(len(added),sum(report['added_points'].values()))
  for lat,lon,lat2,lon2,km,km2,tid in added:
   self.assertEqual((lat,lon,km),(lat2,lon2,km2));self.assertLess(tid,len(tracks))
 def test_duplicate_conflicting_points_and_idempotence(self):
  t={'coord':'FBR','ramal':'VPB','asset':'MF-VPB-ABC_DEF-L000001','parent':'MF-VPB-ABC_DEF','line':'L1','name':'Original'}
  records=[(t,(-20000000,-44000000,100000)),(t,(-20001000,-44000000,100000)),(t,(-20000000,-44000000,100000))]
  tracks,binary,stats=complete([],b'',records)
  self.assertEqual(len(tracks),1);self.assertEqual(len(binary),56);self.assertEqual(stats['duplicate_source_records'],1);self.assertEqual(stats['ambiguous_asset_km_groups'],1)
  again,b2,st=complete(tracks,binary,records);self.assertEqual(again,tracks);self.assertEqual(b2,binary);self.assertEqual(sum(st['added_points'].values()),0)
 def test_preserves_full_original_association(self):
  a={'coord':'FCL','ramal':'VPB','asset':'MF-VPB-ABC_DEF-L000001','parent':'MF-VPB-ABC_DEF','line':'L1','name':'Original'}
  b={**a,'parent':'MF-VPB-OUTRO','name':'Outro registro original'}
  tracks,binary,stats=complete([],b'',[(a,(-20000000,-44000000,100000)),(b,(-20000000,-44000000,100000))]);self.assertEqual(len(tracks),2);self.assertEqual(len(point_index(tracks,binary)),2)
