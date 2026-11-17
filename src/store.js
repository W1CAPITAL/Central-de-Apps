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
