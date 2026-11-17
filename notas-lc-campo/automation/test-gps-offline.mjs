import fs from 'node:fs';import vm from 'node:vm';import zlib from 'node:zlib';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=n=>fs.readFileSync(new URL(n,root));
const ctx={navigator:{onLine:false,geolocation:{}},setTimeout,clearTimeout,Date};vm.createContext(ctx);vm.runInContext(read('gps.js').toString(),ctx);
const point={coords:{latitude:-21.483568,longitude:-43.536120,accuracy:15},timestamp:Date.now()};
let calls=[];ctx.navigator.geolocation.getCurrentPosition=(ok,error,options)=>{calls.push(options);ok(point)};
assert.equal((await ctx.LCGPS.read({allowRecent:true})).reused,false);assert.equal(calls[0].maximumAge,0);
calls=[];ctx.navigator.geolocation.getCurrentPosition=(ok,error,options)=>{calls.push(options);calls.length===1?error({code:3}):ok({...point,timestamp:Date.now()-30000})};
assert.equal((await ctx.LCGPS.read({allowRecent:true})).reused,true);assert.equal(calls[1].maximumAge,60000);
calls=[];ctx.navigator.geolocation.getCurrentPosition=(ok,error)=>{calls.push(1);error({code:1})};await assert.rejects(ctx.LCGPS.read({allowRecent:true}),e=>e.code===1);assert.equal(calls.length,1);
calls=[];ctx.navigator.geolocation.getCurrentPosition=(ok,error)=>{calls.push(1);calls.length===1?error({code:2}):ok({...point,timestamp:Date.now()-70000})};await assert.rejects(ctx.LCGPS.read({allowRecent:true}),e=>e.code===3);
ctx.navigator.geolocation.getCurrentPosition=()=>{};await assert.rejects(ctx.LCGPS.read({timeout:1}),e=>e.code===3);
// Load the real app with its original offline references and the recovered route data.
const nodes=new Map,buttons=[];const node=key=>{if(!nodes.has(key))nodes.set(key,{value:'',hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},close(){this.open=false},showModal(){this.open=true},querySelectorAll:()=>[],classList:{toggle(){}},focus(){},addEventListener(){}});return nodes.get(key)};
const appctx={console,Blob,File,URL,TextDecoder,TextEncoder,Uint8Array,Int32Array,AbortController,crypto:globalThis.crypto,setTimeout,clearTimeout,navigator:{onLine:false,geolocation:{getCurrentPosition:ok=>ok(point)}},localStorage:{getItem:()=>null,setItem(){}},window:{addEventListener(){}},document:{querySelector:node,querySelectorAll:selector=>selector==='[data-candidate]'?buttons:[]},fetch(){throw Error('GPS must not request the network offline')}};
vm.createContext(appctx);for(const f of ['core.js','audit.js','gps.js'])vm.runInContext(read(f).toString(),appctx);
const code=read('app.js').toString();vm.runInContext(code.split("\n$('#beginAgainBtn').onclick=")[0],appctx);
const unpack=name=>{const b=zlib.gunzipSync(read(name));return new Int32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))};
appctx.originalTracks=JSON.parse(read('tracks.json'));appctx.originalRail=unpack('rail.bin.gz');appctx.routeData={tracks:JSON.parse(read('gps-routes.json')),rail:unpack('gps-routes.bin.gz')};
const run=s=>vm.runInContext(s,appctx);run('tracks=originalTracks;rail=originalRail;routeReferences=routeData;render=()=>{};persist=async()=>{};sessions=[{id:"test",treatments:{old:{status:"Manter",note:{id:"000012345678"}}}}];activeId="test";');
assert(appctx.RailCore.candidates(appctx.originalRail,appctx.originalTracks,point.coords.latitude,point.coords.longitude,15).length>0,'Original source point now belongs to the detailed references');
const choices=run('gpsCandidates(-21.483568,-43.536120,15)');assert(choices.length>0);const chosenTrack=choices[0].track||appctx.originalTracks[choices[0].trackId];assert.equal(chosenTrack.coord,'FFB');assert.equal(chosenTrack.ramal,'LC1');assert.equal(choices[0].km,318440);assert(choices[0].distance<8);assert(choices[0].pointReference);assert(!chosenTrack.routeOnly);assert(chosenTrack.asset.startsWith('MF-LC1-'));assert(chosenTrack.line);
const originalLengths=[appctx.originalTracks.length,appctx.originalRail.length],history=run('JSON.stringify(active().treatments)');
buttons.push({dataset:{candidate:'0'}});await run('gps()');assert(node('#dialogContent').innerHTML.includes('Confirme o trecho'));assert.equal(run('position'),null,'Fallback reference must be confirmed');buttons[0].onclick();
assert.equal(run('position.km'),318440);assert.equal(run('position.source'),'GPS');assert.equal(run('restoredPosition(active().lastPosition).km'),318440);assert.equal(run('position.lat'),point.coords.latitude);assert.equal(run('JSON.stringify(active().treatments)'),history);assert.equal(node('#gpsBtn').disabled,false);
assert.deepEqual([appctx.originalTracks.length,appctx.originalRail.length],originalLengths);
// A recent reading remains pending until the person confirms it, with its true timestamp.
run('position={source:"Manual",km:316500,lat:null,lon:null}');let recentCalls=0;const recentTime=Date.now()-30000;
appctx.navigator.geolocation.getCurrentPosition=(ok,error)=>++recentCalls===1?error({code:3}):ok({...point,timestamp:recentTime});
await run('gps()');assert.equal(run('position.source'),'Manual');assert(node('#dialogContent').innerHTML.includes('menos de 1 minuto'));buttons[0].onclick();assert.equal(run('position.source'),'GPS recente confirmado');assert.equal(run('position.gpsTime'),new Date(recentTime).toISOString());run('renderPosition()');assert.match(node('#sourceLabel').textContent,/GPS recente/);
// A failed GPS request must preserve the manual location and release its button.
run('position={source:"Manual",km:316500,lat:null,lon:null}');appctx.navigator.geolocation.getCurrentPosition=(ok,error)=>error({code:1});await run('gps()');assert.equal(run('position.source'),'Manual');assert.equal(run('position.km'),316500);assert.equal(node('#gpsBtn').disabled,false);assert.match(node('#locationWarning').textContent,/Permita/);
// Offline readiness must reuse the installed worker, without network registration.
let registrations=0;appctx.navigator.serviceWorker={getRegistration:async()=>({active:{postMessage(_m,ports){ports[0].reply()}}}),register(){registrations++;throw Error('offline')}};
appctx.MessageChannel=class{constructor(){this.port1={close(){}};this.port2={reply:()=>queueMicrotask(()=>this.port1.onmessage({data:{ready:true}}))}}};await run('setupOffline()');assert.equal(registrations,0);assert.equal(run('offlineReady'),true);
console.log('PASS: offline GPS at original public coordinates -> FFB/LC1 318+440; original source at the original segment; confirmation; no invented asset/line; permission/timeout/stale fix; no manual GPS conversion; saved evaluations unchanged; installed worker reused offline.');
