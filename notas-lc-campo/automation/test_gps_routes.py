import gzip,hashlib,json,math,struct,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];APP=ROOT/'notas-lc-campo'
class GPSRouteReferencesTest(unittest.TestCase):
 def test_original_source_and_records(self):
  report=json.loads((APP/'automation/gps-routes-source.json').read_text());source=(ROOT/report['source']).read_bytes();tracks=json.loads((APP/'gps-routes.json').read_text());binary=gzip.decompress((APP/'gps-routes.bin.gz').read_bytes())
  self.assertEqual(hashlib.sha256(source).hexdigest(),report['source_sha256']);self.assertEqual(hashlib.sha256(binary).hexdigest(),report['binary_sha256']);self.assertEqual(hashlib.sha256((APP/'gps-routes.json').read_bytes()).hexdigest(),report['tracks_sha256'])
  originals=set(struct.iter_unpack('<8i',source));centers=['FAN','FAR','FBA','FBC','FBJ','FBP','FBR','FBV','FCL','FDE','FFB','FJC','FOJ','FPI','FPL','FPT','FTA','IPA','IPG'];routes=['','LC1','LC2']
  count=0
  for row in struct.iter_unpack('<7i',binary):
   track=tracks[row[6]];self.assertTrue(track['routeOnly']);self.assertEqual(track['line'],'');self.assertFalse(track['asset'].startswith('MF-'))
   self.assertIn((*row[:6],centers.index(track['coord']),routes.index(track['ramal'])),originals);count+=1
  self.assertEqual(count,sum(report['segments'].values()))
