'use strict';
const bridge=window.w1Central;
const byId=id=>document.getElementById(id);
const LABELS={bundled:'Disponível no computador',starting:'Iniciando',running:'Aberto',error:'Precisa de atenção'};
let currentState=null;
function el(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}
function productCard(app){
 const card=el('article','product-card '+app.id);
 card.dataset.name=String(app.name||app.id);
 const top=el('div','card-top');
 const logo=el('img','app-mark');
 const mark=['lexispredict','infinitum','predictbot'].includes(app.id)?app.id:'central';
 logo.src='./brand/'+mark+'.png';
 logo.alt='';
 top.appendChild(logo);
 const ident=el('div','card-ident');
 ident.append(el('h3',null,app.name),el('span','card-kicker',app.subtitle));
 top.appendChild(ident);
 const badge=el('span','product-badge',app.status?.phase==='error'?'!':'✓');
 badge.title=LABELS[app.status?.phase]||'Disponível';
 badge.setAttribute('aria-label',badge.title);
 top.appendChild(badge);
 const copy=el('div','card-copy');
 copy.appendChild(el('p',null,app.description));
 const bottom=el('div','card-bottom');
 const independentlyInstalled=app.installation?.installed===true;
 const launch=el('button','launch-btn',(independentlyInstalled?'Abrir ':'Abrir na Central · ')+app.name);
 launch.type='button';
 launch.disabled=app.status?.phase==='starting'||app.installation?.phase==='installing';
 launch.addEventListener('click',async()=>{
  launch.disabled=true;launch.textContent='Abrindo...';
  try{await (independentlyInstalled?bridge.openInstalledProduct(app.id):bridge.launch(app.id))}
  catch(error){launch.textContent='Não foi possível abrir';launch.title=String(error?.message||'Falha local')}
  finally{launch.disabled=false}
 });
 bottom.appendChild(launch);
 const d=app.download||{};
 const area=el('div','product-download');
 area.appendChild(el('p','oc-note',d.version?'Windows v'+d.version+(d.preview?' · Prévia não assinada':' · Estável'):'Sem instalador disponível'));
 const name=app.name;
 const text=d.phase==='downloading'?'Baixando '+(d.percent||0)+'%':d.phase==='downloaded'?'Instalador baixado':'Baixar '+name+' para Windows';
 const download=el('button','secondary',text);
 download.type='button';
 download.disabled=!d.version||d.phase==='downloading'||d.phase==='downloaded';
 download.title=d.preview?'Download de teste, não entra no canal automático.':'Baixar instalador oficial para Windows.';
 download.addEventListener('click',async()=>{
  download.disabled=true;
  try{await bridge.downloadProduct(app.id)}
  catch(error){card.appendChild(el('p','card-error',String(error?.message||'Falha no download.')))}
  finally{download.disabled=false}
 });
 area.appendChild(download);
 if(d.phase==='downloaded'){
  const show=el('button','secondary','Mostrar instalador baixado');
  show.type='button';
  show.addEventListener('click',()=>bridge.showDownload(app.id).catch(()=>{}));
  area.appendChild(show);
 }
 const installState=app.installation||{};
 const action=el('button','accent','Instalar ou atualizar e abrir '+app.name);
 action.type='button';
 action.disabled=!d.version||installState.phase==='installing'||d.phase==='downloading';
 if(installState.phase==='installing')action.textContent='Instalando '+app.name+' no Windows...';
 action.title='A Central baixa, verifica, instala e abre o programa independente do Windows.';
 action.addEventListener('click',async()=>{
  action.disabled=true;
  try{
   const result=await bridge.installProduct(app.id);
   const cardNow=document.querySelector('.product-card.'+app.id);
   if(result?.installed&&cardNow)cardNow.appendChild(el('p','card-install-status',app.name+' instalado. Abrindo o aplicativo independente...'));
  }catch(error){
   const cardNow=document.querySelector('.product-card.'+app.id);
   if(cardNow)cardNow.appendChild(el('p','card-error','Não foi possível concluir a instalação: '+String(error?.message||'Erro do Windows')));
  }finally{action.disabled=false}
 });
 area.appendChild(action);
 if(installState.installed){
  const installed=el('button','secondary','Abrir versão integrada de '+app.name);
  installed.type='button';
  installed.addEventListener('click',async()=>{
   installed.disabled=true;
   try{await bridge.launch(app.id)}
   catch(error){
    const cardNow=document.querySelector('.product-card.'+app.id);
    if(cardNow)cardNow.appendChild(el('p','card-error','Não foi possível abrir: '+String(error?.message||'Falha do Windows')));
   }finally{installed.disabled=false}
  });
  area.appendChild(installed);
  const version=installState.version?' · v'+installState.version:'';
  area.prepend(el('p','card-install-status','Instalado no computador'+version));
 }
 bottom.appendChild(area);
 card.append(top,copy,bottom,el('div','product-state',LABELS[app.status?.phase]||'Disponível'));
 if(d.error)card.appendChild(el('p','card-error',String(d.error)));
 if(app.status?.phase==='error')card.appendChild(el('p','card-error',String(app.status.message||'O aplicativo não iniciou.')));
 return card;
}
function filterCards(){
 const query=byId('catalog-search')?.value.trim().toLocaleLowerCase('pt-BR')||'';
 for(const card of document.querySelectorAll('.product-card,.coming-soon')){
  const name=(card.dataset.name||'').toLocaleLowerCase('pt-BR');
  card.hidden=!!query&&!name.includes(query);
 }
}
function render(value){
 if(!value||!Array.isArray(value.apps))return;
 currentState=value;
 byId('app-list').replaceChildren(...value.apps.map(productCard));
 byId('apps-count').textContent=String(value.apps.length);
 byId('installed-count').textContent=String(value.apps.filter(x=>['bundled','starting','running'].includes(x.status?.phase)).length);
 byId('store-version').textContent='Central v'+String(value.storeVersion||'0.0.0');
 const automatic=byId('automatic-updates');
 if(automatic)automatic.checked=value.automaticUpdates!==false;
 filterCards();
 const r=value.release||{};
 const available=r.available===true;
 byId('updates-summary').textContent=available?'Atualização':'GitHub Releases';
 const updateMessage=byId('update-message');
 const notes=byId('release-notes'),releaseButton=byId('open-release');
 const downloadNow=byId('download-now'),downloadBackground=byId('download-background');
 const installUpdate=byId('install-update'),progress=byId('download-progress');
 if(available){
  const phase=String(r.phase||'available');
  if(phase==='downloading')updateMessage.textContent='Baixando versão '+r.version+'. Pode continuar trabalhando.';
  else if(phase==='downloaded')updateMessage.textContent='Versão '+r.version+' verificada. Será aplicada ao fechar o aplicativo, substituindo a instalação atual.';
  else if(phase==='error')updateMessage.textContent='Atualização não concluída: '+String(r.error||'O pacote não passou na verificação.');
  else if(r.canDownload)updateMessage.textContent='Central v'+r.version+' disponível para atualização.';
  else updateMessage.textContent='Release identificada, mas sem instalador oficial validável.';
  notes.textContent=String(r.notes||'Detalhes no GitHub Releases.');
  notes.hidden=false;releaseButton.hidden=false;
  downloadNow.hidden=!r.canDownload||!['available','error'].includes(phase);
  downloadBackground.hidden=!r.canDownload||phase!=='available';
  installUpdate.hidden=phase!=='downloaded';
  progress.hidden=phase!=='downloading';
  const pct=Math.min(100,Math.max(0,Number(r.percent)||0));
  byId('download-bar').style.width=pct+'%';
  byId('download-percent').textContent=Math.floor(pct)+'%';
 }else{
  updateMessage.textContent=r.error?String(r.error).slice(0,160):!r.version?'Ainda não há versão estável publicada. As versões de teste ficam no catálogo, mas não são instaladas automaticamente.':'Nenhuma atualização disponível. Os aplicativos continuam funcionando normalmente.';
  notes.hidden=true;releaseButton.hidden=true;downloadNow.hidden=true;downloadBackground.hidden=true;installUpdate.hidden=true;progress.hidden=true;
 }
}
byId('catalog-search')?.addEventListener('input',filterCards);
for(const item of document.querySelectorAll('[data-go]')){
 item.addEventListener('click',()=>{
  for(const nav of document.querySelectorAll('[data-go]')){nav.classList.remove('selected');nav.removeAttribute('aria-current')}
  item.classList.add('selected');item.setAttribute('aria-current','page');
  document.querySelector(item.dataset.go)?.scrollIntoView?.({block:'start',behavior:'smooth'});
 });
}
byId('show-advanced-integration')?.addEventListener('click',()=>{
 const panel=byId('integration-details');panel.open=true;
 panel.scrollIntoView?.({block:'start',behavior:'smooth'});
});
for(const [id,provider] of [['setup-opencode','opencode'],['setup-warp','warp']]){
 byId(id)?.addEventListener('click',async()=>{
  const target=byId(id);target.disabled=true;
  try{await bridge.openOfficialTool(provider)}
  catch{target.title='Não foi possível abrir o site oficial.'}
  finally{target.disabled=false}
 });
}
if(bridge){
 bridge.onState(render);
 bridge.getState().then(render).catch(()=>{byId('update-message').textContent='A Central não conseguiu carregar seu estado local.'});
 byId('automatic-updates')?.addEventListener('change',event=>bridge.setAutomaticUpdates(event.target.checked).catch(()=>{}));
 const check=byId('check-updates');
 check.addEventListener('click',async()=>{
  check.disabled=true;
  try{render(await bridge.checkUpdates())}catch{byId('update-message').textContent='Consulta indisponível. Confira a conexão com o GitHub.'}finally{check.disabled=false}
 });
 byId('open-release').addEventListener('click',()=>bridge.openRelease().catch(()=>{}));
 for(const [id,mode] of [['download-now','now'],['download-background','background']]){
  byId(id).addEventListener('click',async()=>{
   const btn=byId(id);btn.disabled=true;
   try{render(await bridge.downloadUpdate(mode))}
   catch{byId('update-message').textContent='O download oficial não foi concluído.'}
   finally{btn.disabled=false}
  });
 }
 byId('install-update').addEventListener('click',async()=>{
  const btn=byId('install-update');btn.disabled=true;
  try{render(await bridge.installUpdate())}
  catch{byId('update-message').textContent='A atualização não pôde ser iniciada. A instalação atual foi preservada.'}
  finally{btn.disabled=false}
 });
}else byId('update-message').textContent='A ponte local da Central não foi inicializada.';
