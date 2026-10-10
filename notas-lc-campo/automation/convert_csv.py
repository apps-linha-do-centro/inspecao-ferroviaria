#!/usr/bin/env python3
import csv,gzip,json,sys,datetime,re
from pathlib import Path
src,dest=map(Path,sys.argv[1:3])
with src.open(encoding='utf-8-sig',newline='') as f:
    reader=csv.DictReader(f)
    rows=list(reader)
    if not rows: raise SystemExit('CSV vazio')
def get(r,key): return (r.get(key) or '').strip()
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
