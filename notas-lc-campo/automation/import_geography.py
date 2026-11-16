#!/usr/bin/env python3
"""Append original FBR/FBV geometry from the MRS reference workbook; never infer routes."""
import argparse,collections,gzip,hashlib,json,math,struct
from pathlib import Path

SOURCE_FILENAME='Eixo_Pontos_unificado_4326_5M 5.xlsx'

def distance(a,b):
 lat1,lon1,lat2,lon2=map(math.radians,(a[0]/1e6,a[1]/1e6,b[0]/1e6,b[1]/1e6))
 return 6371000*2*math.asin(min(1,math.sqrt(math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2)))

def import_geometry(source,app):
 import openpyxl
 tracks=json.loads((app/'tracks.json').read_text());original_count=len(tracks)
 previous=gzip.decompress((app/'rail.bin.gz').read_bytes());assert len(previous)%28==0
 groups={};points_by_center=collections.Counter();invalid=0
 workbook=openpyxl.load_workbook(source,read_only=True,data_only=True)
 sheet=workbook.active;iterator=sheet.iter_rows(values_only=True);headers=next(iterator);index={k:i for i,k in enumerate(headers)}
 required=['LocalInst','Deno','Linha','Coord','Ramal','LocInstSup','KM','Latitude','Longitude']
 if any(k not in index for k in required):raise ValueError('Original geography workbook contract missing columns')
 for row in iterator:
  value=lambda k:row[index[k]]
  center=str(value('Coord') or '').strip()
  if center not in ('FBR','FBV'):continue
  asset=str(value('LocalInst') or '').strip();ramal=str(value('Ramal') or '').strip()
  if not asset or not ramal or not asset.startswith('MF-'+ramal+'-'):raise ValueError('Asset and original route do not agree')
  meta={'geographySource':SOURCE_FILENAME,'asset':asset,'parent':str(value('LocInstSup') or '').strip(),'coord':center,'line':str(value('Linha') or '').strip(),'ramal':ramal,'name':str(value('Deno') or '').strip()}
  try:
   lat=float(str(value('Latitude')).replace(',','.'));lon=float(str(value('Longitude')).replace(',','.'));km=float(value('KM'))*1000
   if not (-90<=lat<=90 and -180<=lon<=180 and math.isfinite(km) and km>=0):raise ValueError()
  except (TypeError,ValueError):invalid+=1;continue
  key=(center,ramal,asset,meta['parent'],meta['line'],meta['name'])
  if key not in groups:groups[key]={'meta':meta,'points':set()}
  if groups[key]['meta']!=meta:raise ValueError('Conflicting metadata for '+asset+' '+str({k:(groups[key]['meta'].get(k),meta.get(k)) for k in meta if groups[key]['meta'].get(k)!=meta.get(k)}))
  groups[key]['points'].add((round(lat*1e6),round(lon*1e6),round(km)))
  points_by_center[center]+=1
 workbook.close();appended=bytearray();segments_by_center=collections.Counter();new_tracks_by_center=collections.Counter();gaps=0
 existing={(t['coord'],t['ramal'],t['asset'],t.get('parent',''),t.get('line',''),t.get('name','')) for t in tracks}
 for key,group in sorted(groups.items()):
  if key in existing:raise ValueError('Already imported track: '+str(key))
  points=sorted(group['points'],key=lambda p:(p[2],p[0],p[1]));segments=[]
  for a,b in zip(points,points[1:]):
   length=distance(a,b)
   if length==0:continue
   if length>30 or abs(b[2]-a[2])>30:gaps+=1;continue
   segments.append((a[0],a[1],b[0],b[1],a[2],b[2]))
  if not segments:continue
  track_id=len(tracks);tracks.append(group['meta']);new_tracks_by_center[key[0]]+=1
  for segment in segments:appended.extend(struct.pack('<7i',*segment,track_id));segments_by_center[key[0]]+=1
 if not appended:raise ValueError('No validated FBR/FBV geometry was found')
 binary=previous+bytes(appended)
 (app/'tracks.json').write_text(json.dumps(tracks,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 (app/'rail.bin.gz').write_bytes(gzip.compress(binary,compresslevel=9,mtime=0))
 provenance={'source_name':SOURCE_FILENAME,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_drive_id':'1CzU2CLIowGIuyjxNAVO49ckid5SjVwQ2','source_sheet':sheet.title,'centers':['FBR','FBV'],'source_points':dict(points_by_center),'added_tracks':dict(new_tracks_by_center),'added_segments':dict(segments_by_center),'invalid_points':invalid,'excluded_gaps':gaps,'original_tracks':original_count,'original_segments':len(previous)//28,'preserved_prefix_sha256':hashlib.sha256(previous).hexdigest(),'binary_sha256':hashlib.sha256(binary).hexdigest(),'tracks_sha256':hashlib.sha256((app/'tracks.json').read_bytes()).hexdigest(),'rules':{'coordinates':'WGS84; source Latitude/Longitude rounded to 1e-6 degree','km':'source KM in kilometres multiplied by 1000','group':['Coord','Ramal','LocalInst','LocInstSup','Linha','Deno'],'maximum_gap_m':30,'maximum_km_gap_m':30,'inferred_coordinates':False}}
 (app/'automation/geography-source.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(provenance,ensure_ascii=False))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--app',type=Path,required=True);a=p.parse_args();import_geometry(a.source,a.app)
