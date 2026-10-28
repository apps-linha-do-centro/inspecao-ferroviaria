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
        const bytes=attachment.getBytes(),text=Utilities.newBlob(bytes).getDataAsString('UTF-8');
        let kind,stats;
        try{stats=validarTratativas_(text);kind='audits';}catch(ignored){
          try{stats=validarCsvLC_(text);kind='notes';}catch(e){console.log('CSV ignorado: '+attachment.getName()+'. '+e.message);continue;}
        }
        const item={data:when,emailId:message.getId(),nome:attachment.getName(),bytes,total:stats.total,hash:hashV3_(bytes)};
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
        if(!status.total||Math.abs(input.notes.total-status.total)/status.total>CONFIG.variacaoMaxima)throw Error('Variação de volume superior a 35%');
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
