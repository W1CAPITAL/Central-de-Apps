import {createServer} from 'node:net';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {resolveApp,APPS} from './catalog.mjs';

const PORT_MIN=1024,PORT_MAX=65535;
const SUPABASE_URL='https://segjskjlbeydlljnefai.supabase.co';
// Public Supabase publishable key. Never ship service role or sb_secret keys.
const PUBLIC_KEY='sb_publishable_yEX6mVid3dpC7o7eOzuB1g_Vh';
const WA_AUTO='https://lexispredict-wa-auto.onrender.com';

export function validNonce(value){
 return typeof value==='string'&&/^[0-9a-f]{48}$/.test(value);
}
export function isLocalUrl(value,port){
 if(!Number.isInteger(port)||port<PORT_MIN||port>PORT_MAX)return false;
 try{
  const url=new URL(value);
  return url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port===String(port)&&
   url.username===''&&url.password==='';
 }catch{return false}
}
// Next middleware can emit absolute localhost redirects even when bound to
// 127.0.0.1. Preserve the authenticated origin for this exact private server.
export function canonicalProductUrl(value,port){
 try{
  const url=new URL(value);
  if(url.hostname==='localhost')url.hostname='127.0.0.1';
  return isLocalUrl(url.href,port)?url.href:null;
 }catch{return null}
}
export function safeEnvironment(id,port,nonce,systemEnv=process.env){
 resolveApp(id);
 if(!Number.isInteger(port)||port<PORT_MIN||port>PORT_MAX)throw Error('Porta local inválida.');
 if(!validNonce(nonce))throw Error('Identificador de sessão local inválido.');
 const safe={};
 for(const key of ['PATH','Path','SystemRoot','WINDIR','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','LANG','TZ']){
  if(typeof systemEnv[key]==='string')safe[key]=systemEnv[key];
 }
 const defaults={
  ...safe,NODE_ENV:'production',ELECTRON_RUN_AS_NODE:'1',HOSTNAME:'127.0.0.1',PORT:String(port),
  NEXT_PUBLIC_SUPABASE_URL:SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:PUBLIC_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:PUBLIC_KEY
 };
 if(id==='lexispredict')return {
  ...defaults,LEXIS_DESKTOP_STANDALONE:'1',LEXIS_DESKTOP_LOCAL_NONCE:nonce
 };
 return {
  ...defaults,KILLA_DESKTOP_STANDALONE:'1',KILLA_LOCAL_NONCE:nonce,
  NEXT_PUBLIC_LEXIS_SHARED_DB:'1',WA_AUTO_URL:WA_AUTO
 };
}
async function freePort(wanted=0){
 return new Promise((resolve,reject)=>{
  const socket=createServer();
  socket.once('error',reject);
  socket.listen(wanted,'127.0.0.1',()=>{
   const address=socket.address();
   socket.close(error=>error?reject(error):resolve(address.port));
  });
 });
}
function readPort(path){
 try{
  const raw=JSON.parse(readFileSync(path,'utf8'));
  if(Number.isInteger(raw.port)&&raw.port>=PORT_MIN&&raw.port<=PORT_MAX)return raw.port;
 }catch{}
 return null;
}
export async function reserveStablePort(folder,id){
 resolveApp(id);
 mkdirSync(folder,{recursive:true});
 const file=join(folder,id+'-port.json');
 const existing=readPort(file);
 if(existing){
  try{await freePort(existing)}catch{throw Error('Porta da sessão local ocupada; feche outra instância do aplicativo.')}
  return existing;
 }
 const excluded=new Set(Object.keys(APPS).filter(key=>key!==id)
  .map(key=>readPort(join(folder,key+'-port.json'))).filter(Boolean));
 let port=null;
 for(let n=0;n<10;n++){
  const p=await freePort();
  if(!excluded.has(p)){port=p;break}
 }
 if(!port)throw Error('Não foi possível reservar uma porta local exclusiva.');
 try{writeFileSync(file,JSON.stringify({port})+'\n',{mode:0o600,flag:'wx'})}
 catch{
  const saved=readPort(file);
  if(!saved)throw Error('Registro da porta local inválido.');
  if(saved!==port){
   try{await freePort(saved)}catch{throw Error('Porta da sessão local ocupada.')}
  }
  return saved;
 }
 return port;
}
export function isSafeExternalUrl(value){
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password)return false;
  const host=u.hostname.toLowerCase();
  return ['github.com','docs.github.com','supabase.com','accounts.google.com',
    'whatsapp.com','www.whatsapp.com','wa.me','vercel.com',
    'lexispredict-wa-auto.onrender.com'].includes(host)
    ||host.endsWith('.supabase.co')&&/^[a-z0-9-]+\.supabase\.co$/.test(host);
 }catch{return false}
}
