import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const script=fs.readFileSync(new URL('apps-script-v3-extension.gs',import.meta.url),'utf8');
function csv(text,delimiter){const out=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===delimiter&&!quoted){row.push(cell);cell=''}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));out.push(row);row=[];cell=''}else cell+=c}if(cell||row.length){row.push(cell);out.push(row)}return out}
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const ctx={console,Date,Set,CONFIG:{remetentes:['gilberto.viana@mrs.com.br'],destinatario:'felipe.lemos090191@gmail.com',limiteAnexoBytes:2e7,fuso:'America/Sao_Paulo'},normalizarColuna_:normalize,extrairEmail_:s=>s,Utilities:{parseCsv:csv,DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>[...crypto.createHash('sha256').update(Buffer.from(v)).digest()],newBlob:bytes=>({getDataAsString:()=>Buffer.from(bytes).toString()}),formatDate:date=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}};
const audit='INSPEÇÃO | Colaborador,INSPEÇÃO | Início conferência,NOTA ORIGINAL | Número da Nota,INSPEÇÃO | Tratativa,INSPEÇÃO | Texto livre\nFelipe,26/10/2026,000012207119,Manter,\n';
const attachment=text=>({getName:()=> 'qualquer-nome.csv',getSize:()=>text.length,getBytes:()=>[...Buffer.from(text)]});
const msg=(files,delta=0)=>({getDate:()=>new Date(Date.now()-60000-delta),getFrom:()=> 'gilberto.viana@mrs.com.br',getId:()=> 'email'+delta,getTo:()=>ctx.CONFIG.destinatario,getCc:()=>'',getAttachments:()=>files.map(attachment)});
let messages=[];ctx.GmailApp={search:()=>[{getMessages:()=>messages}]};ctx.validarCsvLC_=text=>{if(text!=='NOTES')throw Error('Not notes');return {total:600}};vm.createContext(ctx);vm.runInContext(script,ctx);
messages=[msg(['NOTES',audit])];let r=ctx.buscarEntradasV3_();assert.equal(r.notes.total,600);assert.equal(r.audits.length,1);
messages=[msg(['NOTES'],1000),msg([audit])];r=ctx.buscarEntradasV3_();assert.equal(r.notes.total,600);assert.equal(r.audits.length,1);
messages=[msg([audit]),msg([audit],1000)];r=ctx.buscarEntradasV3_();assert.equal(r.audits.length,1);assert.equal(r.notes,null);
messages=[msg(['NOTES','NOTES',audit])];r=ctx.buscarEntradasV3_();assert.equal(r.notes,null);assert(r.notesError);assert.equal(r.audits.length,1);
assert.throws(()=>ctx.validarTratativas_(audit.replace('26/10/2026','31/02/2026')));assert.throws(()=>ctx.validarTratativas_(audit.replace('Felipe,',',')));
console.log('Passed: same email, separate emails, duplicate snapshot, ambiguous notes do not lose audits, invalid dates and missing auditor.');
