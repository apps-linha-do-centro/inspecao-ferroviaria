process.on('uncaughtException',e=>{console.error(e.message);console.error(String(e.stack).split('\n').filter(l=>l.length<500).join('\n'));process.exit(1)});
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
const root=process.argv[2]?new URL('file://'+process.argv[2]+'/'):new URL('../',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root));
const nodes=new Map;
const node=s=>{if(!nodes.has(s))nodes.set(s,{value:'',textContent:'',innerHTML:'',hidden:false,focus(){},scrollIntoView(){},style:{},classList:{toggle(){}},querySelectorAll:()=>[],close(){this.open=false},showModal(){this.open=true},addEventListener(){},appendChild(){}});return nodes.get(s)};
let registered,stored;
const ctx={console,Blob,File,URL,TextDecoder,TextEncoder,Uint8Array,Int32Array,AbortController,crypto:globalThis.crypto,setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem(){}},window:{addEventListener(){}},navigator:{onLine:true},document:{querySelector:node,querySelectorAll:()=>[],modelContext:{registerTool:t=>{registered=t}}},FormData:class {constructor(form){this.values=form.values}get(k){return this.values[k]}}};
vm.createContext(ctx);vm.runInContext(read('core.js').toString(),ctx);vm.runInContext(read('audit.js').toString(),ctx);vm.runInContext(read('audit-data.js').toString(),ctx);vm.runInContext(read('pdf-lib.min.js').toString(),ctx);
const app=read('app.js').toString();vm.runInContext(app.slice(0,app.indexOf("\n$('#beginAgainBtn').onclick=")),ctx);
const raw=JSON.parse(zlib.gunzipSync(read('notes.json.gz'))),tracks=JSON.parse(read('tracks.json')),binary=zlib.gunzipSync(read('rail.bin.gz')),rail=new Int32Array(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength));
ctx.raw=raw;ctx.tracksInput=tracks;ctx.railInput=rail;
vm.runInContext("base=C.parseBase(raw);tracks=tracksInput;rail=railInput;",ctx);

const core=ctx.RailCore;
ctx.testNote=core.parseBase(raw).notes.find(n=>n.start!==null&&n.end!==null);
ctx.dbStub={transaction(){const tx={objectStore:()=>({put(v){stored=v}})};queueMicrotask(()=>tx.oncomplete?.());return tx}};
vm.runInContext("db=dbStub;sessions=[{id:'corrections-test',employeeId:'001234',collaborator:'Teste',name:'Teste',start:'2026-10-16T19:00:00Z',version:base.version,treatments:{}}];activeId='corrections-test';freshSnapshot=async()=>({source:'Sem GPS',lat:null,lon:null});",ctx);
const run=code=>vm.runInContext(code,ctx);


run("C.classifyLocations(base.notes,tracks,rail);$('#scope').value='all';renderNotes()");
assert.equal(Number(node('#nearCount').textContent),raw.abas[0].linhas.length);
const centers=new Set(raw.abas[0].linhas.map(r=>r[0]));
assert(centers.has('FBR')&&centers.has('FBV'));
for(const c of centers)assert(node('#coordinationOptions').innerHTML.includes('>'+c+'</span>'));
run("selectedCoordinations.add('FBR');selectedCoordinations.add('FBV');renderNotes()");
assert.equal(Number(node('#nearCount').textContent),raw.abas[0].linhas.filter(r=>['FBR','FBV'].includes(r[0])).length);
run("selectedDepartments.add('I');renderNotes()");
const dept=raw.abas[0].colunas.indexOf('Centro de trabalho responsável');
assert.equal(Number(node('#nearCount').textContent),raw.abas[0].linhas.filter(r=>['FBR','FBV'].includes(r[0])&&r[dept].startsWith('I')).length);
assert(!node('#geoCoverageInfo').hidden);
const saved=run('JSON.stringify(sessions)');run('resetFilters();renderNotes()');assert.equal(run('JSON.stringify(sessions)'),saved);
assert.equal(run("displayNoteId('000012345678')"),'000012345678');
const t=run('Object.values(active().treatments)[0]');
ctx.exportSession={name:'Teste',collaborator:'Teste',treatments:{x:{note:{...ctx.testNote,id:'000012345678'},status:'Manter'}}};
const csv=await run('csvBlob(exportSession)').text();assert(csv.includes('"000012345678"'));
// Route matching must never place a new coordination on an old LC line.
const n=ctx.RailCore.parseBase(raw).notes.find(n=>n.center==='FBR'&&n.start!==null);
assert(n);assert(!ctx.RailCore.sameRoute(n,tracks[0]));
assert.equal(ctx.RailCore.near([n],{trackId:0,km:n.start},500,tracks).length,0);
console.log('PASS: six dynamic coordination options; multiple selections; department intersection; all notes including missing KM; original zeros in CSV; sessions untouched; no invented route matches.');

assert.equal(ctx.RailCore.fmtKm(-7847),'Inconsistente na base');

// Regression: km 530 has notes in the new coordinations but no GPS geometry.
const parsed=ctx.RailCore.parseBase(raw).notes;ctx.RailCore.classifyLocations(parsed,tracks,rail);
const refs530=ctx.RailCore.manualReferences(parsed,tracks,rail,530000,500);
assert(refs530.some(r=>r.track.coord==='FBR'&&r.track.ramal==='VPB'&&r.track.manualOnly));
assert(refs530.some(r=>r.track.coord==='FBV'&&r.track.asset==='MF-VPB-FBV_FBV-L000001'));
assert.equal(refs530.length,new Set(refs530.map(r=>r.key)).size);
for(const ref of refs530.filter(r=>r.track.manualOnly)){
 assert(parsed.some(n=>n.asset===ref.track.asset&&n.center===ref.track.coord&&!n.locationIssue&&Math.min(n.start,n.end)<=530500&&Math.max(n.start,n.end)>=529500));
 assert(!('lat' in ref.track)&&!('lon' in ref.track));
 const matched=ctx.RailCore.near(parsed,{km:530000,track:ref.track,trackId:null},500,tracks);
 assert(matched.length>0);assert(matched.every(n=>n.center===ref.track.coord&&n.asset.startsWith('MF-VPB-')));
}
const selected=refs530.find(r=>r.track.coord==='FBV'&&r.track.asset==='MF-VPB-FBV_FBV-L000001');
ctx.selectedManual=selected;const originalTrackCount=tracks.length;
run("manual();$('#manualKm').value='530+000';$('#manualKm').onblur()");
assert(node('#trackSelect').innerHTML.includes('MF-VPB-FBV_FBV-L000001'));
assert(!node('#manualSubmit').disabled);
run("$('#trackSelect').value=selectedManual.key;$('#manualForm').onsubmit({preventDefault(){}})");
assert.equal(run('position.km'),530000);assert.equal(run('position.track.coord'),'FBV');
assert.equal(run('position.lat'),null);assert.equal(run('position.lon'),null);
assert.equal(run('restoredPosition(active().lastPosition).track.asset'),selected.track.asset);
assert.equal(tracks.length,originalTrackCount);
assert.equal(Number(node('#nearCount').textContent),ctx.RailCore.near(parsed,{km:530000,track:selected.track},500,tracks).length);
const refsFar=ctx.RailCore.manualReferences(parsed,tracks,rail,999999999,500);
assert.equal(refsFar.length,0);
run("manual();$('#manualKm').value='999999+999';$('#manualKm').onblur()");
assert(node('#manualSubmit').disabled);
console.log('PASS: manual km 530 includes FBR/FBV assets from notes; route isolation; valid KM ranges; persisted manual reference; null GPS coordinates; no geometry mutation; empty ranges stay blocked.');
