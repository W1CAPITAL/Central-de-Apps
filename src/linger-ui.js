'use strict';
(()=>{
 const bridge=window.w1Central;
 const button=document.getElementById('setup-linger');
 const status=document.getElementById('linger-compatibility');
 if(!bridge||!button||!status)return;
 if(typeof bridge.getLingerCapability==='function'){
  bridge.getLingerCapability().then(result=>{
   status.textContent=String(result?.message||'Confira a compatibilidade do Linger no site oficial.');
  }).catch(()=>{status.textContent='Não foi possível verificar a memória. Confira os requisitos no site oficial.';});
 }
 button.addEventListener('click',async()=>{
  button.disabled=true;
  try{await bridge.openOfficialTool('linger')}
  catch{status.textContent='Falha ao abrir a página oficial do Linger. Use o link indicado na documentação W1.'}
  finally{button.disabled=false}
 });
})();
