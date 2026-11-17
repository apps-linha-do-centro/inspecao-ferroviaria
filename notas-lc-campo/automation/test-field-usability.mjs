import fs from 'node:fs';import vm from 'node:vm';import zlib from 'node:zlib';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=n=>fs.readFileSync(new URL(n,root));
const nodes=new Map,stored=new Map;
const node=s=>{if(!nodes.has(s))nodes.set(s,{value:'',textContent:'',innerHTML:'',hidden:false,style:{},classList:{toggle(){}},querySelectorAll:()=>[],close(){this.open=false},showModal(){this.open=true},addEventListener(){}});return nodes.get(s)};
const ctx={console,TextDecoder,TextEncoder,Uint8Array,Int32Array,AbortController,setTimeout,clearTimeout,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,String(v))},window:{addEventListener(){}},navigator:{onLine:false},document:{querySelector:node,querySelectorAll:()=>[]}};
vm.createContext(ctx);for(const file of ['core.js','audit.js'])vm.runInContext(read(file).toString(),ctx);
const code=read('app.js').toString();vm.runInContext(code.slice(0,code.indexOf("\n$('#beginAgainBtn').onclick=")),ctx);
const raw=JSON.parse(zlib.gunzipSync(read('notes.json.gz'))),tracks=JSON.parse(read('tracks.json')),bytes=zlib.gunzipSync(read('rail.bin.gz'));
ctx.raw=raw;ctx.inputTracks=tracks;ctx.inputRail=new Int32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const run=s=>vm.runInContext(s,ctx);
run('base=C.parseBase(raw);C.classifyLocations(base.notes);tracks=inputTracks;rail=inputRail;queryScope="all"');
// Search/filter renders reuse coverage; a new base or geography must invalidate it.
let checks=0;const match=ctx.RailCore.sameRoute;ctx.RailCore.sameRoute=(...args)=>{checks++;return match(...args)};
run('renderNotes()');assert(checks>0);const firstChecks=checks,warning=node('#geoCoverageInfo').textContent;
run('renderNotes()');node('#search').value='dormente';run('renderNotes()');assert.equal(checks,firstChecks);assert.equal(node('#geoCoverageInfo').textContent,warning);
node('#search').value='';run('base={...base,notes:base.notes.slice()};renderNotes()');assert(checks>firstChecks);const afterBase=checks;
run('tracks=tracks.slice();renderNotes()');assert(checks>afterBase);ctx.RailCore.sameRoute=match;
// Only accepting a new location switches back to near. Settings can still select all.
const history=run('JSON.stringify(sessions)');
for(const source of ['Manual','GPS','GPS recente confirmado']){
 ctx.source=source;run('queryScope="all";setPosition({trackId:0,km:530000,source,lat:null,lon:null})');
 assert.equal(run('queryScope'),'near');assert.equal(stored.get('lc-scope'),'near');assert.equal(node('#listTitle').textContent,'Notas próximas');
 assert.equal(Number(node('#nearCount').textContent),run('C.near(base.notes,position,range,tracks).length'));
}
run('queryScope="all";renderNotes()');assert.equal(Number(node('#nearCount').textContent),raw.abas[0].linhas.length);assert.equal(run('JSON.stringify(sessions)'),history);
// Optional GPS downloads must not hold startup or manual/history access hostage.
let release,started=0;ctx.slowRoutes=new Promise(resolve=>{release=resolve});
run('loadRouteReferences=()=>slowRoutes;openDB=async()=>({});loadCurrentBase=async()=>C.parseBase(raw);loadCompressed=async()=>inputRail;readAll=async()=>[];renderBaseIdentity=()=>{};render=()=>{};showStart=()=>startupDone();registerTools=()=>{};setupBaseUpdateUI=()=>{};setupOffline=async()=>{}');
ctx.startupDone=()=>{started++};ctx.fetch=async()=>({ok:true,json:async()=>tracks});
let timer;try{await Promise.race([run('init()'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Optional GPS blocked startup')),1000)})])}finally{clearTimeout(timer)}
assert.equal(started,1);assert.equal(run('routeReferences'),null);
const extra={tracks:[],rail:[]};release(extra);await Promise.resolve();assert.equal(run('routeReferences'),extra);
assert.equal(run('JSON.stringify(sessions)'),history);
console.log('PASS: accepted GPS/manual position returns to current range; all-notes remains available; coverage reused and invalidated on base/geography changes; identical warning; startup succeeds while optional GPS is pending; late references become available; sessions preserved.');
