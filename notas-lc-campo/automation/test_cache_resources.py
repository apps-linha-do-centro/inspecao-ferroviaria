import tempfile, unittest
from pathlib import Path
from sync_inputs import cache_version

class CacheResourcesTest(unittest.TestCase):
    def test_each_gps_resource_changes_cache_without_changing_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            site=Path(tmp); app=site/'notas-lc-campo'; app.mkdir()
            names=['index.html','notes.json.gz','app.js','base-updates.js','core.js','style.css','tracks.json','rail.bin.gz','audit.js','audit-data.js','gps.js','gps-routes.json','gps-routes.bin.gz']
            for name in names: (app/name).write_bytes(name.encode())
            (app/'sw.js').write_text("const CACHE='notas-lc-test';")
            cache_version(site); baseline=(app/'sw.js').read_text()
            for name in ['gps.js','gps-routes.json','gps-routes.bin.gz']:
                original=(app/name).read_bytes(); (app/name).write_bytes(original+b'changed')
                cache_version(site); self.assertNotEqual((app/'sw.js').read_text(),baseline,name)
                (app/name).write_bytes(original); cache_version(site)
                self.assertEqual((app/'sw.js').read_text(),baseline)
            self.assertEqual((app/'notes.json.gz').read_bytes(),b'notes.json.gz')
            self.assertEqual((app/'audit-data.js').read_bytes(),b'audit-data.js')
