import fs from 'node:fs';import vm from 'node:vm';import zlib from 'node:zlib';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=n=>fs.readFileSync(new URL(n,root));const ctx={};vm.createContext(ctx);vm.runInContext(read('core.js').toString(),ctx);const C=ctx.RailCore;
const tracks=JSON.parse(read('tracks.json')),b=zlib.gunzipSync(read('rail.bin.gz')),rail=new Int32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),tid=tracks.length-1;
const base=C.parseBase(JSON.parse(zlib.gunzipSync(read('notes.json.gz'))));C.classifyLocations(base.notes);const notes=base.notes.filter(n=>C.root(n.asset)==='MF-RPB-FBF_FAW');
const target={id:'nexa-fixture-111',asset:'MF-RPB-FBF_FAW-L000001',center:'FFB',start:111,end:111};assert(C.sameRoute(target,tracks[tid]));assert(C.manualReferences(base.notes,tracks,rail,111,500).some(r=>r.trackId===tid));
const p=C.coordinatesAtKm(target,111,tracks,rail);assert(p&&!p.ambiguous);const choices=C.candidates(rail,tracks,p.lat,p.lon,10);assert.equal(choices[0].trackId,tid);assert(Math.abs(choices[0].km-111)<=2);assert(C.near([...base.notes,target],choices[0],500,tracks).some(n=>n.id===target.id));
for(const n of notes){assert(C.sameRoute(n,tracks[tid]));if(Number.isFinite(n.start)&&n.start>=0&&n.start<=5094){const p=C.coordinatesAtKm(n,n.start,tracks,rail);assert(p&&!p.ambiguous,'Nexa note at '+n.start)}}
assert(C.sameRoute({...target,center:'FCL'},tracks[tid]));assert(!C.sameRoute({...target,asset:'MF-RPB-OTHER_OTHER-L000001'},tracks[tid]));assert(!C.sameRoute({...target,asset:'MF-LC1-FBF_FAW-L000001'},tracks[tid]));
for(const km of [0,1000,2000,3000,4000,5000,5094]){const p=C.coordinatesAtKm(target,km,tracks,rail);assert(p&&!p.ambiguous);assert(C.candidates(rail,tracks,p.lat,p.lon,10).some(v=>v.trackId===tid&&Math.abs(v.km-km)<3))}
console.log('PASS: Nexa GPS and manual km 0+111; current FBF_FAW notes; FCL reference; original markers 0–5 and final 5+094; no unrelated asset/route associations.');
