/** Readiness of the private Next server, without weakening its nonce proof.
 * We do not include response bodies, environment values or the nonce in errors.
 * On slower Windows machines the initial request may be rejected or time out
 * while Next finishes preparing the standalone routes.
 */
export async function waitForLocalHealth({
 name,nonce,url,fetchImpl=fetch,alive=()=>true,wait=ms=>new Promise(r=>setTimeout(r,ms)),
 attempts=100,timeout=2500
}){
 if(typeof name!=='string'||!name||typeof nonce!=='string'||!/^[a-f0-9]{48}$/.test(nonce))
  throw Error('Parâmetros de segurança local inválidos.');
 if(typeof url!=='string'||!/^http:\/\/127\.0\.0\.1:\d+\/api\/desktop\/health$/.test(url))
  throw Error('Endereço de verificação local inválido.');
 let last='sem resposta na porta local';
 for(let i=0;i<attempts;i++){
  if(!alive())throw Error('O servidor local do '+name+' encerrou antes de iniciar.');
  try{
   const response=await fetchImpl(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeout)});
   if(!response.ok){
    last='HTTP '+String(response.status);
   }else{
    let data;
    try{data=await response.json()}catch{last='resposta JSON inválida';}
    if(data){
     if(typeof data.nonce==='string'&&data.nonce!==nonce)
      throw Object.assign(new Error('Identidade da sessão local não corresponde ao produto instalado.'),{securityMismatch:true});
     if(data.ready===true&&data.nonce===nonce)return {ready:true};
     last='rota de saúde não autorizou inicialização';
    }
   }
  }catch(error){
   if(error?.securityMismatch===true)throw error;
   // Never surface untrusted message texts which might contain client secrets.
   const code=String(error?.code||error?.cause?.code||'');
   last=/^(ECONNREFUSED|EADDRINUSE|EACCES|EPERM)$/.test(code)?code:
    error?.name==='TimeoutError'||error?.name==='AbortError'?'tempo esgotado na conexão local':'falha na conexão local';
  }
  if(i+1<attempts)await wait(600);
 }
 throw Error('O servidor local do '+name+' não ficou pronto. Último resultado: '+last+'.');
}
