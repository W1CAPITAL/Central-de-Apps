'use strict';
(()=>{
 const bridge=window.w1Central;
 const check=document.getElementById('oc-desktop-check');
 const repair=document.getElementById('oc-desktop-repair');
 const status=document.getElementById('oc-desktop-update-status');
 if(!bridge?.openCodeDesktopUpdate||!check||!repair||!status)return;
 let busy=false;
 const buttons=flag=>{busy=flag;check.disabled=flag;repair.disabled=flag;};
 bridge.onOpenCodeDesktopProgress?.(percent=>{
  if(busy)status.textContent='Baixando instalador oficial verificado do OpenCode: '+Math.max(0,Math.min(100,Math.floor(Number(percent)||0)))+'%.';
 });
 check.addEventListener('click',async()=>{
  if(busy)return;
  buttons(true);status.textContent='Consultando releases estáveis do desenvolvedor...';
  try{
   const result=await bridge.openCodeDesktopUpdate('check');
   status.textContent='OpenCode Desktop oficial v'+result.version+'. O próprio OpenCode gerencia atualizações automáticas. Se a atualização estiver travada, use Reparar.';
  }catch(error){status.textContent='Não foi possível verificar o OpenCode: '+String(error?.message||'GitHub indisponível.');}
  finally{buttons(false)}
 });
 repair.addEventListener('click',async()=>{
  if(busy)return;
  buttons(true);status.textContent='Confirmando reparo do OpenCode...';
  try{
   const result=await bridge.openCodeDesktopUpdate('repair');
   if(result?.cancelled)status.textContent='Reparo cancelado. Sua instalação atual não foi alterada.';
   else if(result?.launched)status.textContent='Instalador oficial aberto. Conclua a instalação do OpenCode na tela do Windows. Seus projetos não são apagados pela Central.';
   else status.textContent='Não foi possível iniciar o reparo.';
  }catch(error){status.textContent='Não foi possível reparar o OpenCode: '+String(error?.message||'Operação interrompida.');}
  finally{buttons(false)}
 });
})();
