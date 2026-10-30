import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
const site=new URL('../',import.meta.url);
const app=fs.readFileSync(new URL('app.js',site),'utf8').split("\n$('#beginAgainBtn').onclick=")[0];
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('notes.json.gz',site))));
const oldRaw=structuredClone(raw);oldRaw.abas[0].linhas=oldRaw.abas[0].linhas.slice(0,2);
const nextRaw=structuredClone(oldRaw);nextRaw.versao_base=new Date(Date.parse(oldRaw.versao_base+'T00:00:00Z')+86400000).toISOString().slice(0,10);
const previous={raw:oldRaw,status:{version:oldRaw.versao_base,total:2}};
const latest={raw:nextRaw,status:{version:nextRaw.versao_base,total:2}};
function harness(){
 const nodes=new Map,events={};const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{hidden:true,disabled:false,open:false,textContent:'',addEventListener:(name,fn)=>events[selector+name]=fn});return nodes.get(selector)};
 const context={console:{info(){}},Blob,File,URL,AbortController,TextDecoder,TextEncoder,Uint8Array,Int32Array,setTimeout,clearTimeout,pako:{ungzip:zlib.gunzipSync},location:{href:'https://example.test/notas-lc/'},localStorage:{getItem:()=>null},window:{},navigator:{onLine:true},document:{querySelector:node},previous,latest,JSON};
 vm.createContext(context);
 for(const path of ['core.js','audit.js','base-updates.js'])vm.runInContext(fs.readFileSync(new URL(path,site),'utf8'),context);
 context.window.LCAudits={};vm.runInContext(app,context);
 vm.runInContext("base=C.parseBase(previous.raw);currentBaseStatus=previous.status;tracks=[];rail=new Int32Array;render=()=>{};sessions=[{id:'history',treatments:{test:{text:'preserve',note:{id:'000123'}}}}];activeId='history'",context);
 let disk=structuredClone(previous),calls=0;
 context.LCBaseUpdates.save=async data=>{disk=structuredClone(data);calls++};
 context.LCBaseUpdates.read=async()=>structuredClone(disk);
 return {context,node,run:code=>vm.runInContext(code,context),saved:()=>disk,saves:()=>calls};
}
// Network requests bypass stale caches; decode the actual gzip format and reject bad or mixed downloads.
{
 const h=harness(),requests=[];
 h.context.fetch=async(url,options)=>{requests.push({url,options});return url.includes('notes.json')?new Response(zlib.gzipSync(Buffer.from(JSON.stringify(nextRaw)))):Response.json(latest.status)};
 const data=await h.context.LCBaseUpdates.download(latest.status,new AbortController().signal);
 assert.equal(data.raw.versao_base,latest.status.version);
 assert(requests.every(r=>r.url.includes('lc-update=')&&r.options.cache==='no-store'));
 assert.throws(()=>h.context.LCBaseUpdates.validate(nextRaw,{...latest.status,total:3}));
 const duplicate=structuredClone(nextRaw);duplicate.abas[0].linhas[1][2]=duplicate.abas[0].linhas[0][2];assert.throws(()=>h.context.LCBaseUpdates.validate(duplicate,latest.status));
 h.context.fetch=async url=>url.includes('notes.json')?new Response(zlib.gzipSync(Buffer.from(JSON.stringify(nextRaw)))):Response.json({...latest.status,version:'2099-12-31'});
 await assert.rejects(()=>h.context.LCBaseUpdates.download(latest.status,new AbortController().signal));
}
// Offline startup reads the last downloaded dataset without making any network request.
{
 const h=harness();h.context.LCBaseUpdates.read=async()=>structuredClone(latest);h.context.fetch=()=>{throw Error('offline')};h.context.navigator.onLine=false;
 const loaded=await h.run('loadCurrentBase()');assert.equal(loaded.version,latest.status.version);
 await h.run('checkBaseUpdate(true)');assert.match(h.node('#baseUpdateMessage').textContent,/Continue/);
}
// Silent checks fail without blocking work, and simply finding an update never installs it.
{
 const h=harness();h.context.LCBaseUpdates.status=async()=>{throw Error('no signal')};await h.run('checkBaseUpdate()');assert.equal(h.node('#baseUpdatePanel').hidden,true);assert.equal(h.saves(),0);
 h.context.LCBaseUpdates.status=async()=>latest.status;await h.run('checkBaseUpdate(true)');assert.equal(h.node('#updateBaseBtn').hidden,false);assert.equal(h.node('#baseCurrentIndicator').hidden,true);assert.equal(h.run('base.version'),previous.status.version);assert.equal(h.saves(),0);
}
// A published base can predate today. Matching the published version stays discreet after manual and automatic checks.
{
 const h=harness();h.context.LCBaseUpdates.status=async()=>previous.status;
 await h.run('checkBaseUpdate(true)');assert.equal(h.node('#baseUpdatePanel').hidden,true);assert.equal(h.node('#baseCurrentIndicator').hidden,false);
 h.context.navigator.onLine=false;h.run('baseConnectionChanged()');assert.equal(h.node('#baseCurrentIndicator').hidden,true);assert.equal(h.node('#baseUpdatePanel').hidden,true);
}
// A disconnection during download preserves the prior dataset and all historical treatments.
{
 const h=harness(),history=h.run('JSON.stringify(sessions)');let release;
 h.context.LCBaseUpdates.download=async()=>new Promise(resolve=>{release=resolve});h.run('availableBaseStatus=latest.status');
 const task=h.run('downloadBaseUpdate()');h.context.navigator.onLine=false;h.run('baseConnectionChanged()');release(latest);await task;
 assert.equal(h.saves(),0);assert.equal(h.run('base.version'),previous.status.version);assert.equal(h.run('JSON.stringify(sessions)'),history);assert.equal(h.node('#updateBaseBtn').disabled,true);
}
// Storage failure leaves the current base usable; forms stay intact until they are closed.
{
 const h=harness();h.context.LCBaseUpdates.download=async()=>latest;h.context.LCBaseUpdates.save=async()=>{throw Error('quota')};h.run('availableBaseStatus=latest.status');await h.run('downloadBaseUpdate()');assert.equal(h.run('base.version'),previous.status.version);
}
{
 const h=harness(),history=h.run('JSON.stringify(sessions)');h.context.LCBaseUpdates.download=async()=>latest;h.run('availableBaseStatus=latest.status');h.node('#dialog').open=true;
 await h.run('downloadBaseUpdate()');assert.equal(h.saves(),1);assert.equal(h.run('base.version'),previous.status.version);assert.equal(h.saved().status.version,latest.status.version);
 h.node('#dialog').open=false;h.run('applyPendingBase()');assert.equal(h.run('base.version'),latest.status.version);assert.equal(h.run('JSON.stringify(sessions)'),history);assert.equal(h.node('#baseUpdatePanel').hidden,true);assert.equal(h.node('#baseCurrentIndicator').hidden,false);
}
// Requests checking for updates must never receive a cached fallback from the worker.
{
 const handlers={},called=[];
 const ctx={self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn},URL,fetch:request=>{called.push(request.url);return Promise.reject(Error('offline'))},caches:{open:()=>{throw Error('update check used cache')}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('sw.js',site),'utf8'),ctx);
 let response;handlers.fetch({request:{method:'GET',url:'https://example.test/base-status.json?lc-update=1'},respondWith:p=>response=p});await assert.rejects(response);assert.equal(called.length,1);
}
console.log('PASS: offline boot; no-store network checks; gzip validation; incomplete/mixed/duplicate data rejected; no forced update; lost signal; quota failure; deferred application while editing; saved history unchanged; worker bypass.');
