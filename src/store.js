'use strict';
const appList=document.getElementById('app-list');
const updateMessage=document.getElementById('update-message');
const releaseNotes=document.getElementById('release-notes');
const updateButton=document.getElementById('check-updates');
const releaseButton=document.getElementById('open-release');
const downloadNow=document.getElementById('download-now');
const downloadBackground=document.getElementById('download-background');
const installUpdate=document.getElementById('install-update');
const downloadProgress=document.getElementById('download-progress');
const downloadBar=document.getElementById('download-bar');
const downloadPercent=document.getElementById('download-percent');
const bridge=window.w1Central;
const LABELS={bundled:'Disponível no computador',starting:'Iniciando',running:'Aberto',error:'Precisa de atenção'};
function el(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}
function productCard(app){
 const card=el('article','product-card '+app.id);
 const top=el('div','card-top');
 const mark=el('span','app-mark',app.id==='lexispredict'?'L':'∞');
 const badge=el('span','product-badge',app.badge);
 top.append(mark,badge);
 const copy=el('div','card-copy');
 const kicker=el('span','card-kicker',app.subtitle);
 const name=el('h3',null,app.name);
 const desc=el('p',null,app.description);
 copy.append(kicker,name,desc);
 const lower=el('div','card-bottom');
 const status=el('div','product-state');
 status.append(el('span','tiny-dot'),el('span',null,LABELS[app.status?.phase]||'Disponível'));
 const btn=el('button','launch-btn',app.status?.phase==='starting'?'Abrindo...':'Abrir '+app.name);
 btn.type='button';
 btn.disabled=app.status?.phase==='starting';
 btn.addEventListener('click',async()=>{
  btn.disabled=true;btn.textContent='Iniciando...';
  try{await bridge.launch(app.id)}
  catch{btn.textContent='Não foi possível iniciar';btn.disabled=false}
 });
 lower.append(status,btn);
 card.append(top,copy,lower);
 if(app.status?.phase==='error')card.append(el('p','card-error',app.status.message));
 return card;
}
function render(value){
 if(!value||!Array.isArray(value.apps))return;
 appList.replaceChildren(...value.apps.map(productCard));
 document.getElementById('apps-count').textContent=value.apps.length+' produtos';
 document.getElementById('store-version').textContent='Central v'+String(value.storeVersion||'0.0.0');
 const r=value.release||{};
 const available=r.available===true;
 if(available){
  const phase=String(r.phase||'available');
  if(phase==='downloading'){
   updateMessage.textContent='Baixando versão '+r.version+' em segundo plano. Continue usando os aplicativos.';
  }else if(phase==='downloaded'){
   updateMessage.textContent='Atualização '+r.version+' verificada pelo Windows. A instalação aguarda sua confirmação.';
  }else if(phase==='error'){
   updateMessage.textContent='Atualização bloqueada: '+String(r.error||'O pacote não foi validado.');
  }else if(r.canDownload){
   updateMessage.textContent='Central de Apps v'+r.version+' disponível. Confira as alterações antes de baixar.';
  }else{
   updateMessage.textContent='Nova release disponível, mas sem instalador Authenticode e SHA-256 validáveis. Consulte o GitHub.';
  }
  releaseNotes.textContent=String(r.notes||'Atualização disponível no GitHub oficial.');
  releaseNotes.hidden=false;
  releaseButton.hidden=false;
  downloadNow.hidden=!r.canDownload||phase!=='available';
  downloadBackground.hidden=!r.canDownload||phase!=='available';
  installUpdate.hidden=phase!=='downloaded';
  downloadProgress.hidden=phase!=='downloading';
  const percent=Math.min(100,Math.max(0,Number(r.percent)||0));
  downloadBar.style.width=percent+'%';
  downloadPercent.textContent=Math.floor(percent)+'%';
 }else{
  updateMessage.textContent=r.error?'Não foi possível verificar agora. Seus aplicativos locais continuam disponíveis.':'Nenhuma nova versão oficial detectada.';
  releaseNotes.hidden=true;
  releaseButton.hidden=true;
  downloadNow.hidden=true;
  downloadBackground.hidden=true;
  installUpdate.hidden=true;
  downloadProgress.hidden=true;
 }
}
if(bridge){
 bridge.onState(render);
 bridge.getState().then(render).catch(()=>{
  updateMessage.textContent='A ponte local está indisponível. Reinicie a Central de Apps.';
 });
 updateButton.addEventListener('click',async()=>{
  updateButton.disabled=true;
  try{render(await bridge.checkUpdates())}
  finally{updateButton.disabled=false}
 });
 releaseButton.addEventListener('click',()=>bridge.openRelease().catch(()=>{}));
 downloadNow.addEventListener('click',async()=>{
  downloadNow.disabled=true;
  try{render(await bridge.downloadUpdate('now'))}
  catch{updateMessage.textContent='O Windows não pôde iniciar a atualização assinada.'}
  finally{downloadNow.disabled=false}
 });
 downloadBackground.addEventListener('click',async()=>{
  downloadBackground.disabled=true;
  try{render(await bridge.downloadUpdate('background'))}
  catch{updateMessage.textContent='O download seguro não foi concluído.'}
  finally{downloadBackground.disabled=false}
 });
 installUpdate.addEventListener('click',async()=>{
  installUpdate.disabled=true;
  try{render(await bridge.installUpdate())}
  catch{updateMessage.textContent='A instalação foi bloqueada. O programa atual foi preservado.'}
  finally{installUpdate.disabled=false}
 });
}else{
 updateMessage.textContent='A inicialização segura do aplicativo falhou.';
}

if(bridge?.openCode){
 const byId=id=>document.getElementById(id);
 const status=byId('opencode-status'),output=byId('oc-output'),sessions=byId('oc-session');
 let connected=false,polling=false,timer,generation=0,view='messages';
 const show=value=>{output.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);};
 const request=(action,input={})=>bridge.openCode(action,input);
 async function refreshSessions(){const items=await request('sessions');const selected=sessions.value;sessions.replaceChildren(...items.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.id;return o;}));if(items.some(s=>s.id===selected))sessions.value=selected;}
 async function run(action,input){const current=generation;view=action==='prompt'?'messages':action;try{const result=await request(action,input);if(current===generation)show(result);return result;}catch(error){show(String(error.message||'Operação falhou.'));throw error;}}
 function bind(id,action,build){byId(id).addEventListener('click',async()=>{const button=byId(id);button.disabled=true;try{await run(action,build?build():{sessionId:sessions.value});}catch{}finally{button.disabled=false;}});}
 byId('opencode-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;status.textContent='Conectando...';
  clearInterval(timer);connected=false;generation++;const current=generation;output.textContent='';byId('oc-workspace').hidden=true;
  try{
   const result=await request('connect',{mode:byId('oc-mode').value,executable:byId('oc-executable').value.trim(),directory:byId('oc-directory').value.trim(),url:byId('oc-url').value.trim(),password:byId('oc-password').value,userId:byId('oc-user').value.trim(),companyId:byId('oc-company').value.trim()});
   byId('oc-password').value='';connected=true;byId('oc-workspace').hidden=false;status.textContent='Conectado · OpenCode '+result.version;await refreshSessions();show({version:result.version,capabilities:result.capabilities});
   // Poll real responses; never fabricate progress from an animation.
   timer=setInterval(async()=>{if(!connected||polling||!sessions.value||document.hidden||!['messages','prompt'].includes(view))return;polling=true;try{const result=await request('messages',{sessionId:sessions.value});if(current===generation&&view==='messages')show(result);}catch{status.textContent='Falha ao atualizar respostas. Reconecte para testar.';}finally{polling=false;}},5000);
  }catch(error){status.textContent=String(error.message||'Falha de conexão.');}finally{button.disabled=false;}
 });
 byId('oc-detect').addEventListener('click',async()=>{try{const found=await request('detect',{executable:byId('oc-executable').value.trim()});status.textContent=found.installed?'OpenCode '+found.version+' encontrado':found.message;if(found.installed)byId('oc-executable').value=found.executable;}catch{status.textContent='Não foi possível detectar a instalação.';}});
 byId('oc-disconnect').addEventListener('click',async()=>{connected=false;generation++;clearInterval(timer);await request('disconnect');output.textContent='';byId('oc-workspace').hidden=true;status.textContent='Desconectado';byId('oc-password').value='';});
 byId('oc-create').addEventListener('click',async()=>{try{const session=await run('create',{title:'Tarefa W1 Capital',mode:byId('oc-permissions').value});await refreshSessions();sessions.value=session.id;}catch{}});
 bind('oc-send','prompt',()=>({sessionId:sessions.value,text:byId('oc-prompt').value}));
 bind('oc-messages','messages');bind('oc-diff','diff');bind('oc-abort','abort');
 bind('oc-mcp-list','mcp');
 bind('oc-mcp-save','mcpSave',()=>({name:byId('oc-mcp-name').value.trim(),config:JSON.parse(byId('oc-mcp-config').value)}));
 for(const [id,action] of [['oc-mcp-connect','mcpConnect'],['oc-mcp-disconnect','mcpDisconnect'],['oc-mcp-remove','mcpRemove']])bind(id,action,()=>({name:byId('oc-mcp-name').value.trim()}));
}
