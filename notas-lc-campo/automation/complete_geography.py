#!/usr/bin/env python3
"""Preserve every original reference point without connecting discontinuous geometry."""
import argparse,collections,gzip,hashlib,json,math,struct
from pathlib import Path
SOURCE_NAME='Eixo_Pontos_unificado_4326_5M 5.xlsx'
CENTERS=('FBC','FBJ','FBR','FBV','FCL','FFB')
FIELDS=('coord','ramal','asset','parent','line','name')
def key(t):return tuple(str(t.get(f) or '').strip() for f in FIELDS)
def point_index(tracks,binary):
 result=collections.defaultdict(set)
 for a,b,c,d,k1,k2,tid in struct.iter_unpack('<7i',binary):
  result[key(tracks[tid])].update(((a,b,k1),(c,d,k2)))
 return result

def complete(tracks,binary,records):
 """Append explicit source points only. Existing tracks and segments keep their indices."""
 tracks=[dict(t) for t in tracks];known=point_index(tracks,binary);ids=collections.defaultdict(list)
 for i,t in enumerate(tracks):ids[key(t)].append(i)
 groups={};raw=collections.Counter();km_positions=collections.defaultdict(set)
 for t,p in records:
  if t['coord'] not in CENTERS:continue
  lat,lon,km=p
  if not(-90000000<=lat<=90000000 and -180000000<=lon<=180000000 and km>=0):raise ValueError('Invalid original reference point')
  if not t['asset'].startswith('MF-'+t['ramal']+'-'):raise ValueError('Original asset/route conflict')
  k=key(t);groups.setdefault(k,{'meta':dict(t),'points':set()})['points'].add(p);raw[t['coord']]+=1;km_positions[(k,km)].add((lat,lon))
 added=bytearray();added_points=collections.Counter();new_tracks=collections.Counter();unique=collections.Counter();represented=collections.Counter()
 for k,g in sorted(groups.items()):
  center=k[0];unique[center]+=len(g['points'])
  missing=g['points']-known[k]
  if missing and not ids[k]:
   ids[k].append(len(tracks));tracks.append({**g['meta'],'geographySource':SOURCE_NAME,'sourcePoints':True});new_tracks[center]+=1
  for lat,lon,km in sorted(missing,key=lambda p:(p[2],p[0],p[1])):
   # A zero-length record is an actual point, never a segment spanning a gap.
   added.extend(struct.pack('<7i',lat,lon,lat,lon,km,km,ids[k][0]));added_points[center]+=1;known[k].add((lat,lon,km))
  represented[center]+=len(g['points']&known[k])
 after=binary+bytes(added)
 group_checks=[{'metadata':g['meta'],'source_points':len(g['points']),'source_points_sha256':hashlib.sha256(b''.join(struct.pack('<3i',*p) for p in sorted(g['points']))).hexdigest(),'app_points':len(known[k]),'app_points_sha256':hashlib.sha256(b''.join(struct.pack('<3i',*p) for p in sorted(known[k]))).hexdigest()} for k,g in sorted(groups.items())]
 assert all(represented[c]==unique[c] for c in raw)
 stats={'groups':group_checks,'source_records':dict(raw),'unique_source_points':dict(unique),'duplicate_source_records':sum(raw.values())-sum(unique.values()),'represented_unique_points':dict(represented),'unrepresented_source_records':{c:0 for c in raw},'added_points':dict(added_points),'added_tracks':dict(new_tracks),'ambiguous_asset_km_groups':sum(len(v)>1 for v in km_positions.values()),'original_tracks':len(tracks)-sum(new_tracks.values()),'original_segments':len(binary)//28,'preserved_binary_prefix_sha256':hashlib.sha256(binary).hexdigest(),'preserved_tracks_prefix_sha256':hashlib.sha256(json.dumps(tracks[:len(tracks)-sum(new_tracks.values())],ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),'binary_sha256':hashlib.sha256(after).hexdigest(),'tracks_sha256':hashlib.sha256(json.dumps(tracks,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()}
 return tracks,after,stats

def source_records(path):
 import openpyxl
 book=openpyxl.load_workbook(path,read_only=True,data_only=True);sheet=book.active;rows=sheet.iter_rows(values_only=True);header=next(rows);ix={v:i for i,v in enumerate(header)}
 for row in rows:
  val=lambda k:row[ix[k]]
  center=str(val('Coord') or '').strip()
  if center not in CENTERS:continue
  meta={'coord':center,'ramal':str(val('Ramal') or '').strip(),'asset':str(val('LocalInst') or '').strip(),'parent':str(val('LocInstSup') or '').strip(),'line':str(val('Linha') or '').strip(),'name':str(val('Deno') or '').strip()}
  lat=float(str(val('Latitude')).replace(',','.'));lon=float(str(val('Longitude')).replace(',','.'));km=float(val('KM'))*1000
  if not(math.isfinite(km) and km>=0 and -90<=lat<=90 and -180<=lon<=180):raise ValueError('Invalid original coordinates/KM')
  yield meta,(round(lat*1e6),round(lon*1e6),round(km))
 book.close()

def process(source,app):
 tracks=json.loads((app/'tracks.json').read_text());binary=gzip.decompress((app/'rail.bin.gz').read_bytes())
 new_tracks,new_binary,stats=complete(tracks,binary,source_records(source))
 prior=app/'automation/geography-completion.json'
 if new_tracks==tracks and new_binary==binary and prior.exists():
  previous=json.loads(prior.read_text())
  if previous.get('source_sha256')==hashlib.sha256(source.read_bytes()).hexdigest():
   print('Already complete; original audit and resources preserved.');return
 (app/'tracks.json').write_text(json.dumps(new_tracks,ensure_ascii=False,separators=(',',':')))
 (app/'rail.bin.gz').write_bytes(gzip.compress(new_binary,compresslevel=9,mtime=0))
 report={'source_name':SOURCE_NAME,'source_drive_id':'1CzU2CLIowGIuyjxNAVO49ckid5SjVwQ2','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'centers':list(CENTERS),**stats,'rules':'Source points retain coordination, original route, asset, parent, line, name, KM and coordinates. No new nonzero segments. No extrapolation across gaps. Distinct positions sharing asset/KM remain distinct and require confirmation.'}
 (app/'automation/geography-completion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items() if k!='groups'},ensure_ascii=False,indent=2),flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--app',type=Path,required=True);a=p.parse_args();process(a.source,a.app)
