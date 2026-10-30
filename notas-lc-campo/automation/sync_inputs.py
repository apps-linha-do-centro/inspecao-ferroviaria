"""Independent, idempotent updates of notes and inspection inputs. Standard library only."""
import argparse,datetime as dt,gzip,hashlib,json,re,shutil,subprocess,sys,tempfile
from pathlib import Path
from zoneinfo import ZoneInfo
from import_audits import load_data,read_records,merge,save_data

HERE=Path(__file__).resolve().parent

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def cache_version(site):
    app=site/'notas-lc-campo';digest=hashlib.sha256()
    for name in ['index.html','notes.json.gz','app.js','base-updates.js','core.js','style.css','audit.js','audit-data.js']:
        digest.update((app/name).read_bytes())
    p=app/'sw.js';text,n=re.subn(r"const CACHE='notas-lc-[^']+'",f"const CACHE='notas-lc-v30-{digest.hexdigest()[:16]}'",p.read_text(),count=1)
    if n!=1:raise ValueError('Identificador de cache não encontrado')
    p.write_text(text,encoding='utf-8')

def synchronize(site,entry,notes_date=None):
    app=site/'notas-lc-campo';inputs=entry/'notas-lc-campo/automation';marker=app/'automation/processed-inputs.json'
    state=json.loads(marker.read_text()) if marker.exists() else {'version':1,'notes_sha256':None,'audit_sha256':[]}
    report={'notes':'unchanged','audit_files':0,'errors':[]}
    incoming=inputs/'incoming.csv'
    if incoming.exists() and sha(incoming)!=state.get('notes_sha256'):
        try:
            with tempfile.TemporaryDirectory() as temp:
                tmp=Path(temp);staged=tmp/'site';shutil.copytree(app,staged/'notas-lc-campo');converted=tmp/'notes.json.gz'
                subprocess.run([sys.executable,str(HERE/'convert_csv.py'),str(incoming),str(converted)],check=True,capture_output=True,text=True)
                with gzip.open(converted,'rt',encoding='utf-8') as f:data=json.load(f)
                with gzip.open(app/'notes.json.gz','rt',encoding='utf-8') as f:current=json.load(f)
                if data['abas'][0]!=current['abas'][0]:
                    version=notes_date or dt.datetime.now(ZoneInfo('America/Sao_Paulo')).date().isoformat()
                    dt.date.fromisoformat(version)
                    if version<str(current.get('versao_base','')):raise ValueError('Base de notas recebida é anterior à publicada')
                    data['versao_base']=version
                    with gzip.open(converted,'wt',encoding='utf-8') as f:json.dump(data,f,ensure_ascii=False,separators=(',',':'))
                    subprocess.run([sys.executable,str(HERE/'build.py'),'--entrada',str(converted),'--raiz',str(staged)],check=True,capture_output=True,text=True)
                    for name in ['notes.json.gz','base-status.json','index.html','sw.js']:shutil.copyfile(staged/'notas-lc-campo'/name,app/name)
                    report['notes']='updated'
                state['notes_sha256']=sha(incoming)
        except Exception as e:report['errors'].append({'input':'notes','reason':str(getattr(e,'stderr',None) or e)[-1000:]})
    audits=load_data(app/'audit-data.js');done=set(state.get('audit_sha256',[]))
    paths=sorted((inputs/'tratativas').glob('*.csv'))
    if (inputs/'incoming-tratativas.csv').exists():paths.append(inputs/'incoming-tratativas.csv')
    for path in paths:
        digest=sha(path)
        if digest in done:continue
        try:
            records,_=read_records(path.read_bytes());audits=merge(audits,records);done.add(digest);report['audit_files']+=1
        except Exception as e:report['errors'].append({'input':path.name,'reason':str(e)})
    save_data(app/'audit-data.js',audits);state['audit_sha256']=sorted(done)
    marker.parent.mkdir(parents=True,exist_ok=True);marker.write_text(json.dumps(state,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    cache_version(site)
    print(json.dumps(report,ensure_ascii=False))
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--site',type=Path,required=True);p.add_argument('--entry',type=Path,required=True);p.add_argument('--notes-date');p.add_argument('--report',type=Path)
    a=p.parse_args();r=synchronize(a.site,a.entry,a.notes_date)
    if a.report:a.report.write_text(json.dumps(r,ensure_ascii=False),encoding='utf-8')
