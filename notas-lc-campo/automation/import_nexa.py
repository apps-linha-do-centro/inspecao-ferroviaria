#!/usr/bin/env python3
"""Append original Nexa WGS84 points, decimated at 5 m; KM calibrated between original markers."""
import argparse,collections,gzip,hashlib,json,math,struct,zipfile
from pathlib import Path
SOURCE_SHA='5ce6249f6dac672e26015c70b5fe7695fab4226721d3f6c4f62a6e3f5b23616c'
ASSET='MF-RPB-FBF_FAW-L000001'
def distance(a,b):
 la,lo,lb,lob=map(math.radians,(*a,*b));return 6371000*2*math.asin(min(1,math.sqrt(math.sin((lb-la)/2)**2+math.cos(la)*math.cos(lb)*math.sin((lob-lo)/2)**2)))
def records(z,stem):
 data=z.read('01. NEXA/'+stem+'.dbf');count,header,width=struct.unpack_from('<IHH',data,4);fields=[]
 for o in range(32,header-1,32):
  f=data[o:o+32];fields.append((f[:11].split(b'\0')[0].decode('utf-8'),chr(f[11]),f[16],f[17]))
 result=[]
 for i in range(count):
  row=data[header+i*width:header+(i+1)*width];assert row[0]==32;at=1;record={}
  for name,kind,size,decimals in fields:
   v=row[at:at+size].decode('utf8').strip();record[name]=float(v) if kind=='N' and v else v;at+=size
  result.append(record)
 return result

def source_points(path):
 if hashlib.sha256(path.read_bytes()).hexdigest()!=SOURCE_SHA:raise ValueError('ZIP differs from reviewed Nexa source')
 with zipfile.ZipFile(path) as z:
  attrs=records(z,'Pontos_Nexa');axes=records(z,'Eixo_Linha_Nexa');raw=z.read('01. NEXA/Pontos_Nexa.shp');assert len(raw)==struct.unpack_from('>i',raw,24)[0]*2
  points=[];at=100
  while at<len(raw):
   _,words=struct.unpack_from('>2i',raw,at);shape=raw[at+8:at+8+words*2];assert struct.unpack_from('<i',shape,0)[0]==1;lon,lat=struct.unpack_from('<2d',shape,4);points.append((lat,lon));at+=8+words*2
  assert len(points)==len(attrs)==17296
  for p,a in zip(points,attrs):assert p==(a['Latitude'],a['Longitude']) and a['Track Numb']=='1'
  final=[a for a in axes if a['Marc_Ini']==5 and a['Marc_Fim']==5];assert len(final)==1 and final[0]['DistOFMarc']==93.510
  assert all(a['Ramal']=='RPB' for a in axes)
 return points,attrs,5093.510

def decimate(points,markers,end_m,spacing=5):
 if len(points)!=len(markers) or not points:raise ValueError('Invalid source points')
 if any(markers[i]<markers[i-1] for i in range(1,len(markers))):raise ValueError('Original marker order changed')
 groups=collections.defaultdict(list)
 for i,k in enumerate(markers):groups[k].append(i)
 if list(groups)!=list(range(6)):raise ValueError('Expected original markers 0 to 5')
 selected=[];calibration=[]
 for marker,ids in groups.items():
  following=groups.get(marker+1);stop=following[0] if following else ids[-1];start=ids[0]
  source_ids=list(range(start,stop+1));cum=[0.0]
  for a,b in zip(source_ids,source_ids[1:]):
   length=distance(points[a],points[b])
   if length>15:raise ValueError('Discontinuous source: no automatic connection allowed')
   cum.append(cum[-1]+length)
  span=(marker+1)*1000-marker*1000 if following else end_m-marker*1000
  if not cum[-1]>0 or not span>0:raise ValueError('Invalid reference interval')
  keep=[0];last=0
  for j in range(1,len(cum)-1):
   if cum[j]-cum[last]>=spacing:keep.append(j);last=j
  keep.append(len(cum)-1)
  for j in keep:
   index=source_ids[j];lat,lon=points[index];km=marker*1000+span*cum[j]/cum[-1]
   item=(round(lat*1e6),round(lon*1e6),round(km),index+1)
   if not selected or item[3]!=selected[-1][3]:selected.append(item)
  calibration.append({'marker':marker,'start_source_record':start+1,'end_source_record':stop+1,'source_length_m':round(cum[-1],6),'km_start_m':marker*1000,'km_end_m':marker*1000+span})
 return selected,calibration

def process(source,app):
 points,attrs,end=source_points(source);selected,calibration=decimate(points,[int(a['KM']) for a in attrs],end)
 tracks=json.loads((app/'tracks.json').read_text());before=gzip.decompress((app/'rail.bin.gz').read_bytes());track_bytes=(app/'tracks.json').read_bytes()
 if any(t.get('geographySource')=='01. NEXA.zip' for t in tracks):raise ValueError('Nexa already imported')
 tid=len(tracks);tracks.append({'coord':'FFB','ramal':'RPB','asset':ASSET,'parent':'MF-RPB-FBF_FAW','line':'L1','name':'Ramal Nexa · km aproximado','geographySource':'01. NEXA.zip','approximateKm':True})
 added=bytearray()
 for a,b in zip(selected,selected[1:]):
  if a[:2]==b[:2]:continue
  added.extend(struct.pack('<7i',*a[:2],*b[:2],a[2],b[2],tid))
 binary=before+added;new_tracks=json.dumps(tracks,ensure_ascii=False,separators=(',',':')).encode();(app/'tracks.json').write_bytes(new_tracks);(app/'rail.bin.gz').write_bytes(gzip.compress(binary,compresslevel=9,mtime=0))
 audit={'source_name':'01. NEXA.zip','source_sha256':SOURCE_SHA,'source_records':len(points),'asset':ASSET,'asset_association':'User explicitly identified FBF_FAW; coord FFB from 32 current SAP notes. Exact asset-root matching also preserves the FCL note.','coordinate_crs':'WGS84, original SHP coordinates rounded to 1e-6 degree; no synthetic coordinates','spacing_m':5,'km_method':'Approximate chainage scaled by original cumulative geodesic distance between original integer KM changes; final marker 5 + 93.510 m from axis DBF. Sample/SEQ not used as metres.','selected_source_records':[p[3] for p in selected],'selected_points':len(selected),'added_segments':len(added)//28,'calibration':calibration,'original_tracks':tid,'original_segments':len(before)//28,'preserved_binary_sha256':hashlib.sha256(before).hexdigest(),'preserved_tracks_sha256':hashlib.sha256(track_bytes).hexdigest(),'binary_sha256':hashlib.sha256(binary).hexdigest(),'tracks_sha256':hashlib.sha256(new_tracks).hexdigest()}
 (app/'automation/nexa-source.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in audit.items() if k!='selected_source_records'},ensure_ascii=False))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--app',type=Path,required=True);a=p.parse_args();process(a.source,a.app)
