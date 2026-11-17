'use strict';
const appList=document.getElementById('app-list');
const updateMessage=document.getElementById('update-message');
const releaseNotes=document.getElementById('release-notes');
const updateButton=document.getElementById('check-updates');
const releaseButton=document.getElementById('open-release');
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
  updateMessage.textContent='Central de Apps v'+r.version+' disponível. Confira as alterações antes de atualizar.';
  releaseNotes.textContent=String(r.notes||'Atualização disponível no GitHub oficial.');
  releaseNotes.hidden=false;
  releaseButton.hidden=false;
 }else{
  updateMessage.textContent=r.error?'Não foi possível verificar agora. Seus aplicativos locais continuam disponíveis.':'Nenhuma nova versão oficial detectada.';
  releaseNotes.hidden=true;
  releaseButton.hidden=true;
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
}else{
 updateMessage.textContent='A inicialização segura do aplicativo falhou.';
}
