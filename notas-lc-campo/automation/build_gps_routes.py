#!/usr/bin/env python3
"""Recover route-level GPS references already published in this repository.

These original records identify coordination and route, not an SAP asset or line.
They are a fallback only when the detailed asset geometry has no nearby segment.
"""
import gzip,hashlib,json,re,struct
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
APP=ROOT/'notas-lc-campo'
html=(ROOT/'index.html').read_text()
js=ROOT/re.search(r'src="\./(assets/[^\"]+\.js)"',html).group(1)
code=js.read_text()
# Read the code dictionaries from the original app, never guess binary indices.
centers=json.loads(re.search(r'(\["FAN","FAR","FBA"[^\]]*\])',code).group(1))
routes=json.loads(re.search(r'(\["","LC1","LC2"\])',code).group(1))
source=(ROOT/'railway-segments-v2.bin').read_bytes()
tracks=[];ids={};binary=bytearray();counts=Counter()
for row in struct.iter_unpack('<8i',source):
 lat1,lon1,lat2,lon2,km1,km2,center,route=row
 center,route=centers[center],routes[route]
 if center not in ('FBC','FBJ','FCL','FFB') or not route:continue
 if not(-90000000<=lat1<=90000000 and -90000000<=lat2<=90000000 and -180000000<=lon1<=180000000 and -180000000<=lon2<=180000000 and min(km1,km2)>=0):raise ValueError('Invalid original coordinates')
 key=(center,route)
 if key not in ids:
  ids[key]=len(tracks)
  tracks.append({'asset':center+' · '+route,'parent':'','coord':center,'ramal':route,'line':'','name':'Referência por coordenação e ramal · base ferroviária original','routeOnly':True,'geographySource':'railway-segments-v2.bin'})
 binary.extend(struct.pack('<7i',lat1,lon1,lat2,lon2,km1,km2,ids[key]));counts[center+'/'+route]+=1
(APP/'gps-routes.json').write_text(json.dumps(tracks,ensure_ascii=False,separators=(',',':'))+'\n')
(APP/'gps-routes.bin.gz').write_bytes(gzip.compress(binary,compresslevel=9,mtime=0))
report={'source':'railway-segments-v2.bin','source_sha256':hashlib.sha256(source).hexdigest(),'dictionary_source':str(js.relative_to(ROOT)),'dictionary_sha256':hashlib.sha256(js.read_bytes()).hexdigest(),'segments':dict(counts),'binary_sha256':hashlib.sha256(binary).hexdigest(),'tracks_sha256':hashlib.sha256((APP/'gps-routes.json').read_bytes()).hexdigest(),'rules':'Original coordinates and KM retained. No asset/line inferred. Only fallback when detailed GPS references find no segment.'}
(APP/'automation/gps-routes-source.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
