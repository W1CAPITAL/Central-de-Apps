import {randomUUID} from 'node:crypto';
import {copyFile,readFile,writeFile,rename,rm,mkdir,lstat} from 'node:fs/promises';
import {join,dirname,extname} from 'node:path';
import {classifyAttachment} from './attachment-policy.mjs';

const ID=/^[a-f0-9-]{36}$/i;
const TEXT_TYPES=new Set(['.txt','.md','.csv','.json','.log']);
const MAX_ENTRIES=200;

export class PredictBotLibrary{
 #dir;#indexPath;#pending=Promise.resolve();
 constructor({directory}={}){
  if(typeof directory!=='string'||!directory.trim())throw Error('Diretório da biblioteca indisponível.');
  this.#dir=directory;this.#indexPath=join(directory,'index.json');
 }
 async #readIndex(){
  try{
   const value=JSON.parse(await readFile(this.#indexPath,'utf8'));
   if(value?.version===1&&Array.isArray(value.entries))return value.entries;
  }catch(error){if(error.code!=='ENOENT')throw Error('Índice da biblioteca ilegível. Nenhum arquivo foi apagado.');}
  return [];
 }
 async #writeIndex(entries){
  await mkdir(this.#dir,{recursive:true,mode:0o700});
  const temporary=this.#indexPath+'.'+randomUUID()+'.tmp';
  await writeFile(temporary,JSON.stringify({version:1,entries}),{mode:0o600});
  await rename(temporary,this.#indexPath);
 }
 #run(operation){
  const task=this.#pending.then(operation);
  this.#pending=task.catch(()=>{});
  return task;
 }
 async list(){
  await this.#pending;
  const entries=await this.#readIndex();
  return entries.map(({id,name,kind,size,supportedByLocalModel,createdAt})=>
   ({id,name,kind,size,supportedByLocalModel,createdAt}));
 }
 async add(paths){
  if(!Array.isArray(paths)||paths.length<1||paths.length>8)throw Error('Selecione de 1 a 8 arquivos.');
  return this.#run(async()=>{
   let entries=await this.#readIndex();
   if(entries.length+paths.length>MAX_ENTRIES)throw Error('Biblioteca cheia. Remova arquivos antigos antes de importar.');
   const added=[];
   try{
    for(const path of paths){
     const info=await lstat(path);
     if(!info.isFile()||info.isSymbolicLink())throw Error('Somente arquivos comuns podem ser importados.');
     const classified=classifyAttachment(path,info.size);
     const id=randomUUID(),ext=extname(classified.name).toLowerCase();
     const storedName=id+ext;
     await mkdir(join(this.#dir,'files'),{recursive:true,mode:0o700});
     await copyFile(path,join(this.#dir,'files',storedName));
     const row={id,name:classified.name,kind:classified.kind,size:classified.size,
      storedName,supportedByLocalModel:TEXT_TYPES.has(ext),createdAt:new Date().toISOString()};
     added.push(row);
    }
    entries=[...added,...entries];
    await this.#writeIndex(entries);
   }catch(error){
    for(const row of added)await rm(join(this.#dir,'files',row.storedName),{force:true}).catch(()=>{});
    throw error;
   }
   return added.map(({id,name,kind,size,supportedByLocalModel,createdAt})=>
    ({id,name,kind,size,supportedByLocalModel,createdAt}));
  });
 }
 async promptText(ids,{maxChars=1300}={}){
  if(!Array.isArray(ids)||ids.length>4)throw Error('Selecione no máximo 4 arquivos por mensagem.');
  if(ids.length===0)return '';
  const entries=await this.#readIndex();
  const result=[];
  let remaining=Math.min(1800,Math.max(100,Math.trunc(maxChars)||1300));
  for(const id of ids){
   if(typeof id!=='string'||!ID.test(id))throw Error('Seleção de arquivo inválida.');
   const file=entries.find(row=>row.id===id);
   if(!file)throw Error('Arquivo da biblioteca não encontrado.');
   if(!file.supportedByLocalModel)
    throw Error('O Qwen3 local de texto não consegue interpretar '+file.name+'. O arquivo foi salvo na biblioteca, mas exige um modelo multimodal ou extrator apropriado.');
   const contents=await readFile(join(this.#dir,'files',file.storedName),'utf8');
   const chunk=contents.slice(0,Math.max(0,remaining));
   result.push('[Arquivo: '+file.name+']\n'+chunk+'\n[Fim do trecho]');
   remaining-=chunk.length;
   if(remaining<=0)break;
  }
  return result.join('\n');
 }
 async remove(id){
  if(typeof id!=='string'||!ID.test(id))throw Error('Arquivo inválido.');
  return this.#run(async()=>{
   const entries=await this.#readIndex();
   const file=entries.find(item=>item.id===id);
   if(!file)return {removed:false};
   await this.#writeIndex(entries.filter(row=>row.id!==id));
   await rm(join(this.#dir,'files',file.storedName),{force:true});
   return {removed:true};
  });
 }
}
