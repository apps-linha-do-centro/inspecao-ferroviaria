"""Validate inspection CSVs and merge Manter confirmations without replacing history."""
import csv, datetime as dt, io, json, re, unicodedata
from pathlib import Path
from zoneinfo import ZoneInfo

HEADERS=['INSPEÇÃO | Colaborador','INSPEÇÃO | Início conferência','NOTA ORIGINAL | Número da Nota','INSPEÇÃO | Tratativa','INSPEÇÃO | Texto livre']
SOURCE='Consolidado · início da conferência'
def norm_header(v):
    return re.sub('[^a-z0-9]','', ''.join(c for c in unicodedata.normalize('NFD',v.strip().lower()) if not unicodedata.combining(c)))
def note_id(v):
    text=str(v).strip()
    if not re.fullmatch('[0-9]{7,15}',text) or not text.strip('0'):raise ValueError('Número de nota inválido')
    return text.lstrip('0')
def read_records(content, today=None):
    today=today or dt.datetime.now(ZoneInfo('America/Sao_Paulo')).date()
    text=content.decode('utf-8-sig');first=text.splitlines()[0] if text.strip() else ''
    delim=';' if first.count(';')>first.count(',') else ','
    reader=csv.DictReader(io.StringIO(text),delimiter=delim,strict=True)
    headers=reader.fieldnames or [];names={norm_header(h):h for h in headers}
    if len(names)!=len(headers) or any(norm_header(h) not in names for h in HEADERS):raise ValueError('Colunas do consolidado de inspeções ausentes ou duplicadas')
    result={};total=0
    for row in reader:
        if not any(str(v or '').strip() for v in row.values()):continue
        total+=1
        if total>250000 or None in row or any(v is None for v in row.values()):raise ValueError('Estrutura ou volume inválido')
        who,raw_day,raw_id,status,_=[row[names[norm_header(h)]].strip() for h in HEADERS]
        id_=note_id(raw_id)
        if status not in ('Manter','Tratada','Inexistente','Alterar'):raise ValueError('Tratativa inválida')
        date=dt.datetime.strptime(raw_day,'%d/%m/%Y').date()
        if date>today:raise ValueError('Data de conferência futura')
        if status=='Manter':
            if not who:raise ValueError('Conferência sem colaborador')
            item={'day':date.isoformat(),'who':who,'source':SOURCE}
            if item not in result.setdefault(id_,[]):result[id_].append(item)
    if not total:raise ValueError('CSV sem registros')
    return result,total

def load_data(path):
    if not path.exists():return {}
    text=path.read_text(encoding='utf-8').strip();prefix='window.LCAudits='
    if not text.startswith(prefix) or not text.endswith(';'):raise ValueError('Arquivo de conferências fora do contrato')
    raw=json.loads(text[len(prefix):-1]);out={}
    for id_,records in raw.items():
        key=note_id(id_)
        for r in records:
            if r not in out.setdefault(key,[]):out[key].append(r)
    return out

def merge(existing,incoming):
    result={key:list(value) for key,value in existing.items()}
    for id_,records in incoming.items():
        for r in records:
            if r not in result.setdefault(id_,[]):result[id_].append(r)
    for group in result.values():group.sort(key=lambda r:(r['day'],r['who']),reverse=True)
    return result

def save_data(path,data):
    path.write_text('window.LCAudits='+json.dumps(data,ensure_ascii=False,sort_keys=True,separators=(',',':'))+';\n',encoding='utf-8')
