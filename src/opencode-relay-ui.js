'use strict';
if(window.w1Central?.openCodeRelay){
 const bridge=window.w1Central,byId=id=>document.getElementById(id);
 function render(state){const labels={stopped:'Ponte remota desligada',pending:'Confirme o dispositivo na página de conexão',approved:'Ponte remota conectada',executing:'Operação em execução: '+String(state.operation||''),unavailable:'Ponte sem conexão. Confira a internet e o pareamento.'};byId('oc-relay-state').textContent=labels[state.state]||'Aguardando conexão';byId('oc-relay-confirmation').textContent=state.state==='pending'&&state.confirmation?'Código de confirmação: '+state.confirmation:'';}
 bridge.onRelayState?.(render);bridge.openCodeRelay('state').then(render).catch(()=>{});
 byId('oc-relay-portal').addEventListener('click',()=>bridge.openCodeRelay('openPortal').catch(()=>{byId('oc-relay-state').textContent='Não foi possível abrir a página de conexão.';}));
 byId('oc-relay-pair').addEventListener('click',async()=>{const button=byId('oc-relay-pair');button.disabled=true;try{render(await bridge.openCodeRelay('pair',{pairingCode:byId('oc-relay-code').value.trim(),name:byId('oc-relay-name').value.trim()}));}catch{byId('oc-relay-state').textContent='Pareamento não concluído. Conecte o OpenCode e gere outro código.';}finally{byId('oc-relay-code').value='';button.disabled=false;}});
 byId('oc-relay-stop').addEventListener('click',()=>bridge.openCodeRelay('stop').then(render).catch(()=>{}));
}
