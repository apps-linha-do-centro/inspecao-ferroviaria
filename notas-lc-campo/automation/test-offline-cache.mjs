import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),base='https://example.test/notas-lc-campo/sw.js';
const urls=new Map,handlers={},requests=[];let offline=false,failed=null;
const key=v=>typeof v==='string'?new URL(v,base).href:v.url;
const fetcher=async request=>{const url=key(request);requests.push(url);if(offline||url===failed)throw Error('offline');return new Response(url)};
const cache={match:async q=>urls.get(key(q))?.clone(),put:async(q,r)=>urls.set(key(q),r.clone()),add:async q=>{const r=await fetcher(q);urls.set(key(q),r)},addAll:async qs=>{const rs=await Promise.all(qs.map(fetcher));qs.forEach((q,i)=>urls.set(key(q),rs[i]))}};
const context={URL,fetch:fetcher,caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},self:{location:{origin:new URL(base).origin,href:base},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(n,f)=>handlers[n]=f}};
vm.createContext(context);vm.runInContext(source,context);
const files=vm.runInContext('FILES',context);assert(files.includes('gps.js?v=45'));assert(files.includes('gps-routes.bin.gz?v=45'));
let pending;handlers.install({waitUntil:p=>pending=p});await pending;
offline=true;const messages=[];handlers.message({data:{type:'CHECK_READY'},ports:[{postMessage:p=>messages.push(p)}],waitUntil:p=>pending=p});await pending;assert.equal(messages[0].ready,true);
for(const file of files){let response;handlers.fetch({request:{method:'GET',url:key(file),mode:'cors'},respondWith:p=>response=p});assert((await response).ok)}
let response;handlers.fetch({request:{method:'GET',url:'https://example.test/notas-lc-campo/?from=home',mode:'navigate'},respondWith:p=>response=p});assert((await response).ok);
// An update check may fail offline without damaging the complete inspection cache.
handlers.fetch({request:{method:'GET',url:'https://example.test/notas-lc-campo/base-status.json?lc-update=1'},respondWith:p=>response=p});await assert.rejects(response);assert.equal(urls.size,files.length);
// Repair only missing resources. One failed file must not erase or redownload valid files.
offline=false;urls.delete(key('gps-routes.bin.gz?v=45'));urls.delete(key('gps-routes.json?v=45'));failed=key('gps-routes.bin.gz?v=45');requests.length=0;
handlers.message({data:{type:'PREPARE_OFFLINE'},ports:[{postMessage:p=>messages.push(p)}],waitUntil:p=>pending=p});await pending;assert.equal(messages.at(-1).ready,false);assert.equal(requests.length,2);assert(urls.has(key('gps-routes.json?v=45')));assert(urls.has(key('rail.bin.gz?v=48')));
failed=null;requests.length=0;handlers.message({data:{type:'PREPARE_OFFLINE'},ports:[{postMessage:p=>messages.push(p)}],waitUntil:p=>pending=p});await pending;assert.equal(messages.at(-1).ready,true);assert.equal(requests.length,1);
console.log('PASS: complete GPS resources cached; all requests and home shortcut navigation work offline; update failure preserves files; incremental repair retains valid resources.');
