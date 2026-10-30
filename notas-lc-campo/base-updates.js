'use strict';
// A separate database keeps downloaded bases independent from inspection records.
(function(g){
 const DB='mrs-notas-lc-base',STORE='datasets';
 const signature=status=>JSON.stringify(Object.keys(status).sort().map(key=>[key,status[key]]));
 function validateStatus(status){
  if(!status||!/^\d{4}-\d{2}-\d{2}$/.test(status.version)||!Number.isFinite(Date.parse(status.version+'T00:00:00Z'))||new Date(status.version+'T00:00:00Z').toISOString().slice(0,10)!==status.version||!Number.isInteger(status.total)||status.total<1||status.total>250000)throw Error('Identificação da base inválida');
  return status;
 }
 function validate(raw,status){
  validateStatus(status);
  const sheet=raw?.abas?.[0],rows=sheet?.linhas;
  if(raw?.versao_base!==status.version||!Array.isArray(rows)||rows.length!==status.total||!Array.isArray(sheet.colunas)||sheet.colunas.length<13||!Array.isArray(raw.abas[1]?.linhas))throw Error('Download incompleto ou base incompatível');
  const ids=new Set;
  for(const row of rows){const id=String(row?.[2]??'').trim().replace(/^0+(?=\d)/,'');if(!Array.isArray(row)||!id||ids.has(id)||row.length<13)throw Error('Notas inválidas ou duplicadas');ids.add(id)}
  return {raw,status};
 }
 function transact(mode,operation){return new Promise((resolve,reject)=>{
  let database,transaction,settled=false,result;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(error&&transaction)try{transaction.abort()}catch{}database?.close();error?reject(error):resolve(value)};
  const timer=setTimeout(()=>finish(Error('Armazenamento indisponível')),5000);
  let request;
  try{request=indexedDB.open(DB,1)}catch(error){finish(error);return}
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onerror=()=>finish(request.error);
  request.onsuccess=()=>{
   database=request.result;if(settled){database.close();return}
   try{const tx=transaction=database.transaction(STORE,mode),item=operation(tx.objectStore(STORE));item.onsuccess=()=>{result=item.result};tx.oncomplete=()=>finish(null,result);tx.onerror=tx.onabort=()=>finish(tx.error||Error('Não foi possível salvar a base'))}catch(error){finish(error)}
  };
 })}
 async function read(){const item=await transact('readonly',store=>store.get('current'));return item?validate(item.raw,item.status):null}
 async function save(dataset){validate(dataset.raw,dataset.status);await transact('readwrite',store=>store.put(dataset,'current'))}
 const clear=()=>transact('readwrite',store=>store.clear());
 async function fresh(path,signal){
  const url=new URL(path,g.location.href);url.searchParams.set('lc-update',Date.now()+'-'+Math.random().toString(36).slice(2));
  const response=await fetch(url.href,{cache:'no-store',signal});
  if(!response.ok)throw Error('Não foi possível baixar a atualização');
  return response;
 }
 async function status(signal){return validateStatus(await (await fresh('base-status.json',signal)).json())}
 async function download(expected,signal){
  const response=await fresh('notes.json.gz',signal),bytes=new Uint8Array(await response.arrayBuffer());
  const plain=bytes[0]===31&&bytes[1]===139?pako.ungzip(bytes):bytes;
  const raw=JSON.parse(new TextDecoder().decode(plain)),latest=await status(signal);
  if(signature(expected)!==signature(latest))throw Error('A base publicada mudou durante o download. Tente novamente.');
  return validate(raw,latest);
 }
 g.LCBaseUpdates={signature,validateStatus,validate,read,save,clear,status,download};
})(globalThis);
