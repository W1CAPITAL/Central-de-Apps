import {randomUUID} from 'node:crypto';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';

const ID=/^ses_[a-f0-9]{32}$/i;
const MAX_CHAT_MESSAGES=40;
const MAX_CHATS=80;

/** Conversa privada para quem usa o PredictBot sem instalar uma CLI. */
export class LocalPredictBotChat {
 #file;#loadRuntime;#fetch;#runtime;#data;#startup;#busy=new Set();
 constructor({file,loadRuntime,fetchImpl=fetch}={}){
  if(typeof file!=='string'||!file)throw Error('Armazenamento do PredictBot inválido.');
  if(typeof loadRuntime!=='function')throw Error('Motor de IA local não configurado.');
  this.#file=file;this.#loadRuntime=loadRuntime;this.#fetch=fetchImpl;
 }
 async #read(){
  if(this.#data)return this.#data;
  try{
   const data=JSON.parse(await readFile(this.#file,'utf8'));
   if(data?.version!==1||!Array.isArray(data.chats))throw Error('Histórico antigo não reconhecido. Nenhum arquivo foi apagado.');
   this.#data=data;
  }catch(error){
   if(error.code!=='ENOENT')throw error;
   this.#data={version:1,chats:[]};
  }
  return this.#data;
 }
 async #save(){
  const data=await this.#read();
  await mkdir(dirname(this.#file),{recursive:true,mode:0o700});
  const temporary=this.#file+'.'+randomUUID()+'.tmp';
  await writeFile(temporary,JSON.stringify(data),{mode:0o600});
  await rename(temporary,this.#file);
 }
 async start(){
  if(this.#startup)return this.#startup;
  this.#startup=(async()=>{
   const runtime=await this.#loadRuntime();
   const url=new URL(runtime?.endpoint||'');
   if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!/^\d{2,5}$/.test(url.port)||
      url.pathname!=='/v1'||url.username||url.password||url.search||url.hash)
    throw Error('A IA deve responder somente no endereço local do computador.');
   if(!/^[a-f0-9]{64}$/i.test(runtime?.key||''))throw Error('A autenticação da IA local não está pronta.');
   this.#runtime={endpoint:url.origin+'/v1',key:runtime.key};
   await this.#read();
   return {connected:true,mode:'local',sessions:await this.act('sessions')};
  })().catch(error=>{this.#startup=null;throw error});
  return this.#startup;
 }
 async #get(sessionId){
  await this.#read();
  if(typeof sessionId!=='string'||!ID.test(sessionId))throw Error('Conversa não encontrada.');
  const row=this.#data.chats.find(s=>s.id===sessionId);
  if(!row)throw Error('Conversa não encontrada.');
  return row;
 }
 async act(action,input={}){
  await this.#read();
  if(action==='sessions'){
   return this.#data.chats.slice().sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))
    .map(({id,title})=>({id,title}));
  }
  if(action==='create'){
   const now=new Date().toISOString();
   const chat={id:'ses_'+randomUUID().replaceAll('-',''),title:String(input.title||'Nova conversa').slice(0,100),messages:[],updatedAt:now};
   this.#data.chats.unshift(chat);
   this.#data.chats=this.#data.chats.slice(0,MAX_CHATS);
   await this.#save();
   return {id:chat.id,title:chat.title};
  }
  if(action==='messages'){
   const chat=await this.#get(input.sessionId);
   return chat.messages.map(x=>({info:{role:x.role},parts:[{type:'text',text:x.text}]}));
  }
  if(action==='prompt'){
   const chat=await this.#get(input.sessionId);
   if(!this.#runtime)throw Error('A IA ainda não foi iniciada.');
   const text=input.text;
   if(typeof text!=='string'||!text.trim()||text.length>12000)throw Error('Mensagem inválida. Escreva até 12.000 caracteres.');
   if(text.length>2200)throw Error('O modelo local desta versão aceita mensagens de até 2.200 caracteres por vez.');
   if(this.#busy.has(chat.id))throw Error('Já existe uma resposta em andamento nesta conversa.');
   this.#busy.add(chat.id);
   try{
    chat.messages.push({role:'user',text:text.trim()});
    chat.messages=chat.messages.slice(-MAX_CHAT_MESSAGES);
    chat.updatedAt=new Date().toISOString();
    await this.#save();
    const context=chat.messages.slice(-6).map(m=>({role:m.role,content:m.text.slice(-1200)}));
    let response;
    try{
     response=await this.#fetch(this.#runtime.endpoint+'/chat/completions',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),
      headers:{Authorization:'Bearer '+this.#runtime.key,Accept:'application/json','Content-Type':'application/json'},
      body:JSON.stringify({model:'w1-qwen3-1.7b',messages:context,stream:false,max_tokens:256})
     });
    }catch{throw Error('A IA local não respondeu. A mensagem foi salva; ela não será reenviada automaticamente.');}
    if(!response.ok){
     await response.body?.cancel().catch(()=>{});
     throw Error('A IA local respondeu HTTP '+response.status+'. Verifique a conexão local.');
    }
    const length=Number(response.headers.get('content-length')||0);
    if(length>1_000_000)throw Error('Resposta local excessiva.');
    const payload=await response.json();
    const answer=payload?.choices?.[0]?.message?.content;
    if(typeof answer!=='string'||!answer.trim())throw Error('A IA local não enviou uma resposta em texto.');
    chat.messages.push({role:'assistant',text:answer.slice(0,30000)});
    chat.messages=chat.messages.slice(-MAX_CHAT_MESSAGES);
    chat.updatedAt=new Date().toISOString();
    if(chat.title==='Nova conversa')chat.title=text.trim().slice(0,50);
    await this.#save();
    return {accepted:true,finished:true};
   }finally{this.#busy.delete(chat.id)}
  }
  throw Error('Operação de conversa não autorizada.');
 }
}
