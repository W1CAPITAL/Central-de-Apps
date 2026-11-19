import {setTimeout as sleep} from 'node:timers/promises';

/** Une tentativas simultâneas do mesmo produto e libera a fila inclusive após erro. */
export function singleFlight(tasks,key,operation){
 const pending=tasks.get(key);
 if(pending)return pending;
 const task=Promise.resolve().then(operation);
 tasks.set(key,task);
 const clear=()=>{if(tasks.get(key)===task)tasks.delete(key)};
 void task.then(clear,clear);
 return task;
}

/** Health OK do Next não garante que o Electron renderizou a interface. */
export function isProductScreenReady(screen){
 return screen?.ready===true && screen.fatal!==true &&
  Number.isInteger(screen.visibleCharacters) && screen.visibleCharacters>=20;
}

/** Valida a tela renderizada antes de exibi-la, recuperando falhas transitórias. */
export async function loadProductWhenReady({
 navigate,inspect,wait=sleep,onRetry=()=>{},isDestroyed=()=>false,
 attempts=3,checksPerAttempt=16,intervalMs=650
}={}){
 if(typeof navigate!=='function'||typeof inspect!=='function'||typeof wait!=='function')
  throw Error('Rotina de abertura inválida.');
 for(let attempt=1;attempt<=attempts;attempt++){
  if(isDestroyed())throw Error('Janela fechada durante a inicialização.');
  try{
   await navigate();
   for(let check=0;check<checksPerAttempt;check++){
    if(isDestroyed())throw Error('Janela fechada durante a inicialização.');
    const screen=await inspect();
    if(isProductScreenReady(screen))return screen;
    if(screen?.fatal)break;
    if(check<checksPerAttempt-1)await wait(intervalMs);
   }
  }catch(error){
   if(isDestroyed())throw Error('Janela fechada durante a inicialização.');
   // Um erro de rede temporário não deve obrigar a pessoa a fechar e reabrir.
  }
  if(attempt<attempts){
   await onRetry(attempt);
   await wait(Math.min(4000,500*attempt));
  }
 }
 throw Error('O aplicativo não conseguiu carregar a interface após as tentativas automáticas. '+
  'O programa anterior foi preservado. Verifique a Central de Apps e tente novamente.');
}
