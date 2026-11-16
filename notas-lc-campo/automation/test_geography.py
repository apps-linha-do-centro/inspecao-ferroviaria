import gzip,hashlib,json,struct,unittest
from pathlib import Path
APP=Path(__file__).resolve().parents[1]
class OriginalGeographyTest(unittest.TestCase):
 def setUp(self):
  self.source=json.loads((APP/'automation/geography-source.json').read_text())
  self.tracks=json.loads((APP/'tracks.json').read_text())
  self.binary=gzip.decompress((APP/'rail.bin.gz').read_bytes())
 def test_original_geometry_and_track_indices_preserved(self):
  count=self.source['original_segments'];prefix=self.binary[:count*28]
  self.assertEqual(hashlib.sha256(prefix).hexdigest(),self.source['preserved_prefix_sha256'])
  self.assertEqual(hashlib.sha256(self.binary).hexdigest(),self.source['binary_sha256'])
  self.assertEqual(hashlib.sha256((APP/'tracks.json').read_bytes()).hexdigest(),self.source['tracks_sha256'])
  for row in struct.iter_unpack('<7i',self.binary[:count*28]):self.assertLess(row[6],self.source['original_tracks'])
 def test_new_geometry_has_original_route_asset_and_valid_endpoints(self):
  added=self.tracks[self.source['original_tracks']:]
  self.assertEqual(len(added),sum(self.source['added_tracks'].values()))
  self.assertEqual({t['coord'] for t in added},{'FBR','FBV'})
  self.assertTrue(any(t['coord']=='FBR' and t['ramal']=='TOD' for t in added))
  self.assertTrue(any(t['coord']=='FBV' and t['ramal']=='ACL' for t in added))
  for t in added:
   self.assertTrue(t['asset'].startswith('MF-'+t['ramal']+'-'))
   self.assertEqual(t['geographySource'],self.source['source_name'])
  rows=list(struct.iter_unpack('<7i',self.binary[self.source['original_segments']*28:]))
  self.assertEqual(len(rows),sum(self.source['added_segments'].values()))
  from import_geography import distance
  for row in rows:
   self.assertLessEqual(distance((row[0],row[1]),(row[2],row[3])),30.001)
   self.assertGreaterEqual(row[6],self.source['original_tracks']);self.assertLess(row[6],len(self.tracks))
   self.assertTrue(-90000000<=row[0]<=90000000 and -180000000<=row[1]<=180000000)
   self.assertLessEqual(abs(row[5]-row[4]),30)
 def test_fbv_530_has_original_geographic_segments(self):
  matching=[r for r in struct.iter_unpack('<7i',self.binary) if min(r[4:6])<=530000<=max(r[4:6]) and self.tracks[r[6]]['coord']=='FBV' and self.tracks[r[6]]['ramal']=='VPB']
  self.assertTrue(matching)
  self.assertTrue(any(self.tracks[r[6]]['asset']=='MF-VPB-FBV_FBV-L000001' for r in matching))
