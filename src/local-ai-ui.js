'use strict';
(()=>{
 const bridge=window.w1Central;
 const byId=id=>document.getElementById(id);
 const statusEl=byId('local-ai-status'),messageEl=byId('local-ai-message');
 const progressEl=byId('local-ai-progress'),barEl=byId('local-ai-bar'),percentEl=byId('local-ai-percent');
 const prepareButton=byId('local-ai-prepare'),checkButton=byId('local-ai-check');
 if(!bridge?.localAI||!statusEl||!messageEl||!prepareButton)return;
 const active=new Set(['checking','downloading-engine','extracting-engine','downloading-model','starting']);
 const labels={
  unsupported:'Não compatível', 'not-installed':'Não instalada', installed:'Instalada · parada',
  checking:'Verificando', 'downloading-engine':'Baixando motor', 'extracting-engine':'Preparando motor',
  'downloading-model':'Baixando modelo',starting:'Carregando modelo',ready:'Pronta'
 };
 const formatBytes=value=>{
  const n=Number(value)||0;
  if(n<1024)return n+' B';
  if(n<1024**2)return (n/1024).toFixed(1)+' KB';
  return (n/1024**2).toFixed(1)+' MB';
 };
 function render(state){
  if(!state||typeof state!=='object')return;
  const phase=String(state.phase||'not-installed');
  statusEl.textContent=labels[phase]||phase;
  messageEl.textContent=String(state.message||'');
  if(phase==='ready'&&state.endpoint){
   messageEl.textContent='IA local pronta em '+state.endpoint+'. Modelo w1-local/bitnet-2b disponível para chat e tarefas simples, sem uso de ferramentas. Seu modelo padrão não foi alterado.';
  }
  const downloading=active.has(phase);
  if(progressEl)progressEl.hidden=!downloading;
  if(barEl)barEl.style.width=Math.min(100,Math.max(0,Number(state.percent)||0))+'%';
  if(percentEl){
   const pct=Math.floor(Math.min(100,Math.max(0,Number(state.percent)||0)));
   percentEl.textContent=state.totalBytes>0?pct+'% · '+formatBytes(state.receivedBytes)+' / '+formatBytes(state.totalBytes):state.receivedBytes?formatBytes(state.receivedBytes)+' baixados':downloading?'Preparando...':'';
  }
  prepareButton.disabled=downloading||state.supported===false;
  prepareButton.textContent=phase==='ready'?'IA local pronta':downloading?'Preparando...':state.installed?'Iniciar IA local':'Preparar automaticamente';
 }
 async function refresh(){
  try{render(await bridge.localAI('status'))}
  catch(error){messageEl.textContent=String(error?.message||'Não foi possível consultar a IA local.')}
 }
 prepareButton.addEventListener('click',async()=>{
  prepareButton.disabled=true;
  try{render(await bridge.localAI('prepare'))}
  catch(error){
   statusEl.textContent='Precisa de atenção';
   messageEl.textContent=String(error?.message||'A instalação da IA local não foi concluída.');
  }finally{prepareButton.disabled=false}
 });
 checkButton?.addEventListener('click',async()=>{
  checkButton.disabled=true;
  try{render(await bridge.localAI('status'))}
  catch(error){messageEl.textContent=String(error?.message||'Não foi possível verificar a IA local.')}
  finally{checkButton.disabled=false}
 });
 bridge.onLocalAIProgress?.(render);
 void refresh();
})();
