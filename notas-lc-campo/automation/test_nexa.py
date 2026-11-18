import gzip,hashlib,json,struct,unittest
from pathlib import Path
from import_nexa import decimate
APP=Path(__file__).resolve().parents[1]
class NexaTest(unittest.TestCase):
 def test_original_base_and_added_geometry(self):
  a=json.loads((APP/'automation/nexa-source.json').read_text());tracks=json.loads((APP/'tracks.json').read_text());b=gzip.decompress((APP/'rail.bin.gz').read_bytes());before=b[:a['original_segments']*28]
  self.assertEqual(hashlib.sha256(before).hexdigest(),a['preserved_binary_sha256'])
  self.assertEqual(hashlib.sha256(json.dumps(tracks[:a['original_tracks']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),a['preserved_tracks_sha256'])
  self.assertEqual(hashlib.sha256(b).hexdigest(),a['binary_sha256']);self.assertEqual(hashlib.sha256((APP/'tracks.json').read_bytes()).hexdigest(),a['tracks_sha256'])
  self.assertEqual(len(tracks),a['original_tracks']+1);self.assertEqual(tracks[-1]['asset'],'MF-RPB-FBF_FAW-L000001');self.assertTrue(tracks[-1]['approximateKm'])
  rows=list(struct.iter_unpack('<7i',b[len(before):]));self.assertEqual(len(rows),1039);self.assertEqual(a['selected_points'],1040);self.assertEqual(a['source_records'],17296)
  self.assertEqual(rows[0][4],0);self.assertEqual(rows[-1][5],5094)
  self.assertTrue(all(r[4]<=r[5] and r[6]==len(tracks)-1 for r in rows))
  self.assertEqual(a['selected_source_records'],sorted(set(a['selected_source_records'])))
 def test_no_bridging_a_source_gap(self):
  with self.assertRaisesRegex(ValueError,'Discontinuous'):decimate([(-21-i*.01,-43) for i in range(6)], list(range(6)),5093.51)
