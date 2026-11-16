/** V4: seis coordenações verificadas, publicação só dos campos usados pelo app. */
const CENTROS_LC_V4 = {
 CFBC:['LC1','LMG'],CFCL:['LC1','LC2','VPB','RAM','RMB','RPB'],CFFB:['LC1','RPB'],
 CFBJ:['LC1','LSM','SJU'],CFBR:['VPB','TOD','LHO','ACL'],CFBV:['VPB','ACL','LC2']
};
const COLUNAS_NOTAS_V4 = ['Centro para centro de trabalho responsável','Tipo de atividade de manutenção','Número da nota','Texto referente à prioridade','Data da nota','Local de instalação TPLNR','Texto breve','Codificação 1','Texto breve para o código','Marcador para o ponto de partida','Market Dist Start 2','Marcador para o ponto final','Maker Dist End 1'];
function lerNotasV4_(texto){
 const first=String(texto).replace(/^\uFEFF/,'').split(/\r?\n/,1)[0];
 const rows=Utilities.parseCsv(String(texto).replace(/^\uFEFF/,''),first.split(';').length>first.split(',').length?';':',');
 const head=(rows.shift()||[]).map(normalizarColuna_);
 if(new Set(head).size!==head.length||head.some(h=>!h))throw Error('Colunas duplicadas ou vazias');
 const indices=COLUNAS_NOTAS_V4.map(h=>head.indexOf(normalizarColuna_(h)));
 if(indices.some(i=>i<0))throw Error('Colunas obrigatórias de notas ausentes');
 const data=rows.filter(r=>r.some(c=>String(c||'').trim()));
 if(data.length<500||data.length>250000)throw Error('Volume de notas inválido');
 const counts={},ids=new Set();let assets=0,dates=0;
 for(const row of data){
  if(row.length!==head.length)throw Error('Registro de notas incompleto');
  const v=indices.map(i=>String(row[i]||'').trim()),center=v[0].toUpperCase(),id=v[2].replace(/^0+(?=\d)/,'');
  if(!CENTROS_LC_V4[center]||!/^\d{7,15}$/.test(v[2])||!Number(id)||ids.has(id))throw Error('Coordenação ou número de nota inválido/duplicado');
  ids.add(id);counts[center.slice(1)]=(counts[center.slice(1)]||0)+1;
  if(v[3]&&!['1-Muito alta','2-Alta','3-Média','4-Baixa'].includes(v[3]))throw Error('Criticidade desconhecida');
  if([v[9],v[11]].some(k=>k&&!/^KM\s*\d+(?:[.,]\d+)?$/i.test(k)))throw Error('Marcador KM inválido');
  const asset=v[5].toUpperCase().split('-');if(asset[0]==='MF'&&CENTROS_LC_V4[center].includes(asset[1]))assets++;
  if(/^\d{2}\/\d{2}\/20\d{2}$/.test(v[4]))dates++;
 }
 if(Object.keys(counts).length!==Object.keys(CENTROS_LC_V4).length)throw Error('Relatório parcial: faltam coordenações');
 if(assets/data.length<.75||dates/data.length<.80)throw Error('Perfil ferroviário ou datas divergentes');
 return {head,data,total:data.length,counts};
}
function validarCsvLCV4_(text){const r=lerNotasV4_(text);return {total:r.total,counts:r.counts};}
function sanitizarNotasV4_(text){
 const r=lerNotasV4_(text),cols=COLUNAS_NOTAS_V4.concat(['Campo de ordenação','Centro de trabalho responsável']);
 const indices=cols.map(h=>r.head.indexOf(normalizarColuna_(h)));
 const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 return [cols,...r.data.map(row=>indices.map(i=>i<0?'':row[i]))].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
}
function validarVolumeV4_(file,status,day){
 const counts=file.counts||{},expected=Object.keys(CENTROS_LC_V4).map(c=>c.slice(1));
 if(expected.some(c=>!counts[c])||Object.keys(counts).some(c=>!expected.includes(c)))throw Error('Relatório parcial ou coordenação desconhecida');
 for(const c of Object.keys(status.coordination_counts||{}))if((counts[c]||0)<status.coordination_counts[c]*.65)throw Error('Queda superior a 35% na coordenação '+c);
 const expansion=AMPLIACAO_LC_V4;
 const confirmed=status.total===expansion.previous_total&&day===expansion.date&&file.hash===expansion.source_sha256&&expected.every(c=>counts[c]===expansion.counts[c]);
 if(!status.total||Math.abs(file.total-status.total)/status.total>.35&&!confirmed)throw Error('Variação de volume superior a 35%');
}
const AMPLIACAO_LC_V4 = {"date":"2026-11-16","previous_total":1651,"counts":{"FBC":421,"FCL":521,"FFB":332,"FBJ":377,"FBR":1502,"FBV":1479},"source_sha256":"19bc993b681b0973fa41ed5fab158dd7e24e8f8e575d45375d32b120952d3eae","rows_sha256":"47d7545effa4eaee351eea7692c0a7d148cab42ae4254b2e264f4b8b2e274f01"};
/** V3: duas entradas independentes. Mantém CONFIG, validadores e GITHUB_TOKEN da V2. */
const COLUNAS_TRATATIVAS = ['INSPEÇÃO | Colaborador','INSPEÇÃO | Início conferência','NOTA ORIGINAL | Número da Nota','INSPEÇÃO | Tratativa','INSPEÇÃO | Texto livre'];

function validarTratativas_(texto) {
  texto=String(texto||'').replace(/^\uFEFF/,'');
  const first=texto.split(/\r?\n/,1)[0];
  const rows=Utilities.parseCsv(texto,first.split(';').length>first.split(',').length?';':',');
  const head=(rows.shift()||[]).map(normalizarColuna_);
  const indices=COLUNAS_TRATATIVAS.map(h=>head.indexOf(normalizarColuna_(h)));
  if(indices.some(i=>i<0)||new Set(head).size!==head.length)throw Error('Colunas de tratativas ausentes ou duplicadas');
  const data=rows.filter(r=>r.some(c=>String(c||'').trim()));
  if(!data.length||data.length>250000)throw Error('Volume de tratativas inválido');
  const today=Utilities.formatDate(new Date(),CONFIG.fuso,'yyyy-MM-dd');
  for(const row of data){
    if(row.length!==head.length)throw Error('Registro de tratativa incompleto');
    const [who,rawDay,id,status]=indices.map(i=>String(row[i]||'').trim());
    if(!/^\d{7,15}$/.test(id)||!id.replace(/0/g,''))throw Error('Número de nota inválido');
    if(!['Manter','Tratada','Inexistente','Alterar'].includes(status))throw Error('Tratativa inválida');
    const m=rawDay.match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);
    if(!m)throw Error('Data de conferência inválida');
    const iso=m[3]+'-'+m[2]+'-'+m[1];
    const date=new Date(iso+'T12:00:00-03:00');
    if(isNaN(date.getTime())||Utilities.formatDate(date,CONFIG.fuso,'yyyy-MM-dd')!==iso||iso>today)throw Error('Data de conferência inválida ou futura');
    if(status==='Manter'&&!who)throw Error('Manter sem colaborador');
  }
  return {total:data.length};
}
function hashV3_(bytes){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(v=>('0'+(v&255).toString(16)).slice(-2)).join('');}
function buscarEntradasV3_(){
  const now=Date.now(),since=now-7*86400000;
  const query='{'+CONFIG.remetentes.map(e=>'from:'+e).join(' ')+'} to:'+CONFIG.destinatario+' has:attachment after:'+Math.floor(since/1000);
  const result={notes:null,audits:[],notesError:null},seen=new Set();
  for(let offset=0;;offset+=100){
    const threads=GmailApp.search(query,offset,100);
    for(const thread of threads)for(const message of thread.getMessages()){
      const when=message.getDate().getTime();
      if(when<since||when>now||!CONFIG.remetentes.includes(extrairEmail_(message.getFrom())))continue;
      const recipients=[message.getTo(),message.getCc(),typeof message.getBcc==='function'?message.getBcc():''].join(',').toLowerCase();
      if(!recipients.includes(CONFIG.destinatario))continue;
      let notesInEmail=0;
      for(const attachment of message.getAttachments({includeInlineImages:false,includeAttachments:true})){
        if(!/\.csv$/i.test(attachment.getName())||attachment.getSize()>CONFIG.limiteAnexoBytes)continue;
        let bytes=attachment.getBytes();const text=Utilities.newBlob(bytes).getDataAsString('UTF-8');
        let kind,stats;
        try{stats=validarTratativas_(text);kind='audits';}catch(ignored){
          try{stats=validarCsvLCV4_(text);kind='notes';}catch(e){console.log('CSV ignorado: '+attachment.getName()+'. '+e.message);continue;}
        }
        if(kind==='notes')bytes=Utilities.newBlob(sanitizarNotasV4_(text)).getBytes();
        const item={counts:stats.counts,data:when,emailId:message.getId(),nome:attachment.getName(),bytes,total:stats.total,hash:hashV3_(bytes)};
        if(kind==='notes'){
          notesInEmail++;
          if(notesInEmail>1){result.notesError='Dois CSVs completos de notas no mesmo e-mail; revisão necessária';continue;}
          if(!result.notes||when>result.notes.data)result.notes=item;
        }else if(!seen.has(item.hash)){seen.add(item.hash);result.audits.push(item);}
      }
    }
    if(threads.length<100)break;
  }
  result.audits.sort((a,b)=>a.data-b.data||a.hash.localeCompare(b.hash));
  if(result.notesError)result.notes=null;
  return result;
}
function enviarEntradaV3_(path,file,token){
  const url='https://api.github.com/repos/'+CONFIG.repositorio+'/contents/'+path;
  const response=requisicaoGitHub_(url+'?ref='+encodeURIComponent(CONFIG.branch),'get',token);
  let current=null;
  if(response.getResponseCode()===200){
    current=JSON.parse(response.getContentText());
    const original=lerConteudoGitHub_(path,CONFIG.branch,token);
    if(bytesIguais_(file.bytes,original.bytes))return false;
  }else if(response.getResponseCode()!==404)throw Error('Erro ao consultar entrada: HTTP '+response.getResponseCode());
  const payload={message:'Receber base Notas LC / conferências',branch:CONFIG.branch,content:Utilities.base64Encode(file.bytes)};
  if(current)payload.sha=current.sha;
  const sent=requisicaoGitHub_(url,'put',token,payload);
  if(![200,201].includes(sent.getResponseCode()))throw Error('Erro ao gravar entrada: HTTP '+sent.getResponseCode());
  return true;
}
function estadoProcessadoV3_(token){
  const path='notas-lc-campo/automation/processed-inputs.json';
  const response=requisicaoGitHub_('https://api.github.com/repos/'+CONFIG.repositorio+'/contents/'+path+'?ref=main','get',token);
  if(response.getResponseCode()===404)return {notes_sha256:null,audit_sha256:[]};
  if(response.getResponseCode()!==200)throw Error('Falha ao consultar publicação: HTTP '+response.getResponseCode());
  const original=lerConteudoGitHub_(path,'main',token);
  return JSON.parse(Utilities.newBlob(original.bytes).getDataAsString('UTF-8'));
}
function atualizarNotasLC(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(30000)){console.log('Outra atualização em andamento');return;}
  try{
    const input=buscarEntradasV3_();
    if(!input.notes&&!input.audits.length){if(input.notesError)throw Error(input.notesError);console.log('Sem entradas compatíveis nos últimos 7 dias');return;}
    const props=PropertiesService.getScriptProperties(),token=props.getProperty('GITHUB_TOKEN');
    if(!token)throw Error('GITHUB_TOKEN não configurado');
    const processed=estadoProcessadoV3_(token);const auditDone=new Set(processed.audit_sha256||[]);
    let pending=false;const failures=input.notesError?[input.notesError]:[];
    if(input.notes&&processed.notes_sha256!==input.notes.hash){
      try{
        const raw=lerConteudoGitHub_('notas-lc-campo/base-status.json','main',token);
        const status=JSON.parse(Utilities.newBlob(raw.bytes).getDataAsString('UTF-8'));
        const day=Utilities.formatDate(new Date(input.notes.data),CONFIG.fuso,'yyyy-MM-dd');
        if(day<String(status.version||''))throw Error('Base de notas anterior à publicada');
        validarVolumeV4_(input.notes,status,day);
        enviarEntradaV3_(CONFIG.caminho,input.notes,token);pending=true;
      }catch(e){failures.push('Notas: '+e.message);}
    }
    for(const file of input.audits){
      if(auditDone.has(file.hash))continue;
      try{enviarEntradaV3_('notas-lc-campo/automation/tratativas/'+file.hash+'.csv',file,token);pending=true;}
      catch(e){failures.push('Conferências: '+e.message);}
    }
    if(pending){dispatchAtualizacao_(token);console.log('Entradas encaminhadas; aguardando validação independente no GitHub');}
    else console.log('Sem arquivos novos pendentes de publicação');
    if(failures.length)throw Error(failures.join('; '));
  }finally{lock.releaseLock();}
}
