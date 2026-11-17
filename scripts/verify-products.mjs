import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {safeEnvironment} from '../src/runtime-policy.mjs';

const folder=resolve(import.meta.dirname,'..','dist','win-unpacked');
const exe=join(folder,'W1 Central de Apps.exe');
const resources=join(folder,'resources');
if(process.platform!=='win32')throw Error('Smoke test do EXE exige Windows.');
if(!existsSync(exe))throw Error('EXE da Central não existe no pacote Electron.');
async function port(){
 return new Promise((resolvePort,reject)=>{
  const server=createServer();
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{
   const address=server.address();
   server.close(error=>error?reject(error):resolvePort(address.port));
  });
 });
}
for(const id of ['lexispredict','infinitum']){
 const root=join(resources,'products',id);
 const entry=join(root,'server.js');
 for(const file of [entry,join(root,'node_modules','next','package.json'),join(root,'.next','BUILD_ID')]){
  if(!existsSync(file))throw Error('Arquivo do '+id+' ausente do EXE: '+file);
 }
 const p=await port();
 const nonce=id==='lexispredict'?'a'.repeat(48):'b'.repeat(48);
 const env=safeEnvironment(id,p,nonce);
 const child=spawn(exe,[entry],{
  cwd:root,env,windowsHide:true,stdio:['ignore','ignore','pipe'],shell:false
 });
 let crashed=false;
 child.once('error',()=>{crashed=true});
 child.once('exit',()=>{crashed=true});
 child.stderr?.resume();
 let ready=false;
 try{
  for(let n=0;n<100;n++){
   if(crashed)throw Error(id+' encerrou antes do teste HTTP.');
   try{
    const res=await fetch('http://127.0.0.1:'+p+'/api/desktop/health',{
     redirect:'manual',signal:AbortSignal.timeout(1000)
    });
    if(res.ok){
     const json=await res.json();
     if(json?.ready===true&&json.nonce===nonce){ready=true;break}
    }
   }catch{}
   await sleep(300);
  }
  if(!ready)throw Error(id+' não iniciou localmente dentro do EXE.');
  const page=await fetch('http://127.0.0.1:'+p+'/',{
   redirect:'follow',signal:AbortSignal.timeout(15000)
  });
  if(!page.ok||!page.headers.get('content-type')?.includes('text/html'))
   throw Error(id+' não retornou tela inicial HTML: HTTP '+page.status);
  console.log(id+': servidor local real + tela inicial confirmados.');
 }finally{
  if(child.exitCode===null)child.kill();
 }
}
console.log('Central W1 aprovada: INFINITUM e LexisPredict dentro do EXE, sem Vercel.');
