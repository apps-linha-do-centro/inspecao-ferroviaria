#!/usr/bin/env python3
import csv,gzip,json,sys,datetime,re,unicodedata
from pathlib import Path

src,dest=map(Path,sys.argv[1:3])

# O nome e assunto do e-mail nao fazem parte da verificacao de identidade do relatorio.
# Exigimos o formato detalhado das notas LC, para nao confundir com AMV, OS ou analises parciais.
REQUIRED=(
    'Centro para centro de trabalho responsável',
    'Tipo de atividade de manutenção',
    'Número da nota',
    'Texto referente à prioridade',
    'Data da nota',
    'Local de instalação TPLNR',
    'Texto breve',
    'Codificação 1',
    'Texto breve para o código',
    'Marcador para o ponto de partida',
    'Market Dist Start 2',
    'Marcador para o ponto final',
    'Maker Dist End 1',
)
def normalize_header(value):
    plain=''.join(ch for ch in unicodedata.normalize('NFKD',str(value or ''))
                  if not unicodedata.combining(ch))
    return re.sub(r'[^a-z0-9]', '', plain.casefold())

with src.open(encoding='utf-8-sig',newline='') as f:
    reader=csv.DictReader(f)
    names={normalize_header(h):h for h in (reader.fieldnames or []) if h is not None}
    missing=[h for h in REQUIRED if normalize_header(h) not in names]
    if missing:
        raise SystemExit('REJEITADO: anexo nao e a base completa Notas LC. Faltam colunas: '+', '.join(missing))
    rows=list(reader)
    if not rows:
        raise SystemExit('CSV vazio')

def get(r,key):
    return (r.get(names[normalize_header(key)]) or '').strip()

# A validacao final em build.py tambem exige de 500 a 250000 registros, sem
# duplicidades, e bloqueia queda/aumento anormal da base (>35%) e criticidade inesperada.
# Para volumes de producao, acrescentamos verificacao do perfil ferroviario.
if len(rows)>=500:
    total=len(rows)
    invalid_ids=sum(not re.fullmatch(r'\d{7,15}',get(r,'Número da nota')) for r in rows)
    lc_centers=sum(get(r,'Centro para centro de trabalho responsável').upper()
                   in ('CFFB','CFCL','CFBC','CFBJ') for r in rows)
    lc_assets=sum(get(r,'Local de instalação TPLNR').upper().startswith('MF-LC')
                  for r in rows)
    dates=sum(bool(re.fullmatch(r'\d{2}/\d{2}/20\d{2}',get(r,'Data da nota')))
              for r in rows)
    if invalid_ids or lc_centers/total<.75 or lc_assets/total<.75 or dates/total<.80:
        raise SystemExit('REJEITADO: perfil divergente do relatorio de notas LC; '
                         f'IDs invalidos={invalid_ids}, centros LC={lc_centers}/{total}, '
                         f'ativos LC={lc_assets}/{total}, datas={dates}/{total}')
out=[]
for r in rows:
    nota=get(r,'Número da nota')
    if not nota: raise SystemExit('Nota sem número')
    rawprio=get(r,'Texto referente à prioridade')
    # Preserve a classificacao original. Converter '3-Média' em 'P3'
    # muda o significado e quebra filtros/cores do aplicativo.
    priority=rawprio
    centro=get(r,'Centro para centro de trabalho responsável').removeprefix('C')
    out.append([
      centro,get(r,'Tipo de atividade de manutenção'),nota,priority,
      get(r,'Data da nota'),get(r,'Local de instalação TPLNR'),
      get(r,'Texto breve'),get(r,'Codificação 1'),get(r,'Texto breve para o código'),
      get(r,'Marcador para o ponto de partida').replace('KM','KM '),
      get(r,'Market Dist Start 2'),get(r,'Marcador para o ponto final').replace('KM','KM '),
      get(r,'Maker Dist End 1')
    ])
columns=['Coordenação','TAM','Número da Nota','Prioridade','Data da Nota','Ativo','Descrição','Código anomalia','Anomalia','Marcador inic.','Distância inic.','Marcador final','Distância final']
data={'versao_base':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).strftime('%Y-%m-%d'),'abas':[{'colunas':columns,'linhas':out},{'colunas':['TAM','Descrição'],'linhas':[]}]}
with gzip.open(dest,'wt',encoding='utf-8',compresslevel=9) as f: json.dump(data,f,ensure_ascii=False,separators=(',',':'))
print('Notas convertidas:',len(out))
