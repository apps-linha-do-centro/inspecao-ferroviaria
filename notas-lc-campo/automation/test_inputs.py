import csv,datetime as dt,gzip,hashlib,io,json,shutil,tempfile,unittest
from pathlib import Path
from import_audits import read_records,merge,load_data,HEADERS
from sync_inputs import synchronize
ROOT=Path(__file__).resolve().parents[2]
def sample(id='000012207119',day='26/10/2026',who='Felipe Vieira',status='Manter',delimiter=','):
    stream=io.StringIO();w=csv.writer(stream,delimiter=delimiter);w.writerow(HEADERS);w.writerow([who,day,id,status,'observação não publicada']);return stream.getvalue().encode()
class AuditsTest(unittest.TestCase):
    def test_normalizes_and_keeps_latest(self):
        old,_=read_records(sample(day='13/10/2026'),dt.date(2026,10,27));new,_=read_records(sample(),dt.date(2026,10,27));r=merge(old,new);self.assertEqual(len(r['12207119']),2);self.assertEqual(r['12207119'][0]['day'],'2026-10-26');self.assertEqual(merge(r,new),r)
    def test_semicolon_and_no_other_status_marked(self):
        self.assertIn('12207119',read_records(sample(delimiter=';'),dt.date(2026,10,27))[0]);self.assertFalse(read_records(sample(status='Tratada'),dt.date(2026,10,27))[0])
    def test_invalid_is_rejected(self):
        for kw in [{'id':'=1+1'},{'day':'31/02/2026'},{'day':'29/10/2026'},{'who':''},{'status':'Outro'}]:
            with self.subTest(kw=kw),self.assertRaises((ValueError,KeyError)):read_records(sample(**kw),dt.date(2026,10,27))
    def test_independent_notes_failure_and_duplicate_audit(self):
        with tempfile.TemporaryDirectory() as temp:
            temp=Path(temp);site=temp/'site';entry=temp/'entry';shutil.copytree(ROOT/'notas-lc-campo',site/'notas-lc-campo');folder=entry/'notas-lc-campo/automation';folder.mkdir(parents=True)
            (folder/'incoming.csv').write_text('wrong,columns\n1,2\n');(folder/'tratativas').mkdir();(folder/'tratativas/one.csv').write_bytes(sample());(folder/'tratativas/two.csv').write_bytes(sample())
            r=synchronize(site,entry,'2026-10-27');self.assertEqual(len(r['errors']),1);self.assertEqual(r['audit_files'],1)
            data=load_data(site/'notas-lc-campo/audit-data.js');self.assertIn('12207119',data)
            r=synchronize(site,entry,'2026-10-27');self.assertEqual(r['audit_files'],0)
    def test_missing_notes_does_not_clear_audits(self):
        with tempfile.TemporaryDirectory() as temp:
            temp=Path(temp);site=temp/'site';entry=temp/'entry';shutil.copytree(ROOT/'notas-lc-campo',site/'notas-lc-campo');(entry/'notas-lc-campo/automation').mkdir(parents=True)
            original=load_data(site/'notas-lc-campo/audit-data.js');r=synchronize(site,entry);self.assertFalse(r['errors']);self.assertEqual(load_data(site/'notas-lc-campo/audit-data.js'),original)
    def test_valid_notes_only_or_both_and_repeated_run(self):
        from build import COLUNAS
        columns=['Centro para centro de trabalho responsável','Tipo de atividade de manutenção','Número da nota','Texto referente à prioridade','Data da nota','Local de instalação TPLNR','Texto breve','Codificação 1','Texto breve para o código','Marcador para o ponto de partida','Market Dist Start 2','Marcador para o ponto final','Maker Dist End 1']
        for both in (False,True):
            with self.subTest(both=both),tempfile.TemporaryDirectory() as temp:
                temp=Path(temp);site=temp/'site';entry=temp/'entry';shutil.copytree(ROOT/'notas-lc-campo',site/'notas-lc-campo');folder=entry/'notas-lc-campo/automation';folder.mkdir(parents=True)
                # Fix the copied fixture's date independently of the live published base.
                notes=site/'notas-lc-campo/notes.json.gz'
                with gzip.open(notes,'rt',encoding='utf-8') as f:data=json.load(f)
                data['versao_base']='2026-10-26'
                with gzip.open(notes,'wt',encoding='utf-8') as f:json.dump(data,f,ensure_ascii=False)
                status=site/'notas-lc-campo/base-status.json';data=json.loads(status.read_text());data['total']=600;data['version']='2026-10-26';status.write_text(json.dumps(data))
                with (folder/'incoming.csv').open('w',newline='') as f:
                    w=csv.writer(f);w.writerow(columns)
                    for i in range(600):w.writerow(['CFCL','YRD',str(15500000+i),'3-Média','01/10/2026','MF-LC2-FPK_FPK-L000001','Descrição','AM42','Teste','KM461','0','KM461','0'])
                if both:(folder/'tratativas').mkdir();(folder/'tratativas/valid.csv').write_bytes(sample())
                original=load_data(site/'notas-lc-campo/audit-data.js')
                rejected=synchronize(site,entry,'2026-10-25')
                self.assertEqual(rejected['notes'],'unchanged')
                self.assertIn('anterior à publicada',rejected['errors'][0]['reason'])
                # Restore the audit processing marker before the successful scenario.
                (site/'notas-lc-campo/automation/processed-inputs.json').unlink()
                (site/'notas-lc-campo/audit-data.js').write_bytes((ROOT/'notas-lc-campo/audit-data.js').read_bytes())
                r=synchronize(site,entry,'2026-10-27');self.assertEqual(r['notes'],'updated');self.assertFalse(r['errors']);self.assertEqual(r['audit_files'],int(both))
                if not both:self.assertEqual(load_data(site/'notas-lc-campo/audit-data.js'),original)
                files=[site/'notas-lc-campo'/n for n in ['notes.json.gz','audit-data.js','sw.js','automation/processed-inputs.json']];snapshot=[p.read_bytes() for p in files]
                r=synchronize(site,entry,'2026-10-27');self.assertEqual(r['notes'],'unchanged');self.assertEqual(r['audit_files'],0);self.assertEqual(snapshot,[p.read_bytes() for p in files])
if __name__=='__main__':unittest.main()
