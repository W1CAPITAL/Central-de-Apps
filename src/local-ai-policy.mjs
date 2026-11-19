import {isAbsolute,win32} from 'node:path';

export const LOCAL_AI_ENGINE=Object.freeze({
 version:'b12521',
 fileName:'llama-b12521-bin-win-cpu-x64.zip',
 url:'https://github.com/ggml-org/llama.cpp/releases/download/b12521/llama-b12521-bin-win-cpu-x64.zip',
 size:25555594,
 sha256:'bd4e093bce292452248c318d4b176fbfebe1ca43a7f3779ebb3846fe7753653e'
});

export const LOCAL_AI_MODEL=Object.freeze({
 name:'Qwen3 1.7B Q4_K_M',
 id:'qwen3-1.7b',
 revision:'daeb8e2d528a760970442092f6bf1e55c3b659eb',
 fileName:'Qwen3-1.7B-Q4_K_M.gguf',
 url:'https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF/resolve/daeb8e2d528a760970442092f6bf1e55c3b659eb/Qwen3-1.7B-Q4_K_M.gguf',
 sha256:'d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5',
 size:1282439264
});

export function selectLocalAIProfile({platform,arch,totalMemory,availableMemory,logicalCores}={}){
 const reason=platform!=='win32'?'A instalação automática está preparada para Windows.':
  arch!=='x64'?'Este pacote requer Windows x64.':
  !Number.isFinite(totalMemory)||totalMemory<7.5*1024**3?'O modelo local exige pelo menos 8 GB de RAM para este perfil econômico.':'';
 if(reason)return Object.freeze({supported:false,reason});
 const cores=Number.isInteger(logicalCores)&&logicalCores>0?logicalCores:2;
 // Lightweight resource admission inspired by Linger's free-memory planning.
 // Do not try to run PolyStrata or another large model on this CPU-only profile.
 const lowMemory=Number.isFinite(availableMemory)&&availableMemory>=0&&availableMemory<3*1024**3;
 return Object.freeze({supported:true,threads:lowMemory?1:Math.max(1,Math.min(2,cores)),context:lowMemory?512:1024,output:lowMemory?256:512,gpuLayers:0,parallel:1,idleSleepSeconds:300});
}

export function createLocalAIProviderConfig({port=8765,context=1024}={}){
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Porta da IA local inválida.');
 if(!Number.isInteger(context)||context<512||context>1024)throw Error('Contexto da IA local inválido.');
 return {
  $schema:'https://opencode.ai/config.json',
  providers:{
   'w1-local':{
    name:'W1 Local AI',
    package:'@opencode/ai/providers/openai-compatible',
    settings:{baseURL:'http://127.0.0.1:'+port+'/v1',apiKey:'{env:W1_LOCAL_AI_KEY}',timeout:300000},
    models:{
     'qwen3-1.7b':{
      name:LOCAL_AI_MODEL.name,
      modelID:'w1-qwen3-1.7b',
      capabilities:{tools:false,input:['text'],output:['text']},
      limit:{context,output:Math.min(512,Math.floor(context/2))}
     }
    }
   }
  }
 };
}

export function createLlamaServerArgs({modelPath,keyPath,port=8765,threads=2,context=1024}={}){
 for(const [name,value] of [['modelo',modelPath],['chave',keyPath]]){
  if(typeof value!=='string'||value.includes('\0')||!(isAbsolute(value)||win32.isAbsolute(value)))throw Error('Caminho absoluto do '+name+' é obrigatório.');
 }
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Porta da IA local inválida.');
 if(!Number.isInteger(threads)||threads<1||threads>2)throw Error('O perfil de 8 GB limita a IA local a 1 ou 2 threads.');
 if(!Number.isInteger(context)||context<512||context>1024)throw Error('O contexto local deve ficar entre 512 e 1024 tokens neste perfil.');
 return [
  '--model',modelPath,
  '--host','127.0.0.1',
  '--port',String(port),
  '--api-key-file',keyPath,
  '--ctx-size',String(context),
  '--threads',String(threads),
  '--threads-batch',String(threads),
  '--gpu-layers','0',
  '--parallel','1',
  '--no-webui',
  '--sleep-idle-seconds','300',
  '--alias','w1-qwen3-1.7b'
 ];
}

export function validateAssetRedirect(value,assetType){
 let url;try{url=new URL(value)}catch{throw Error('Redirecionamento de download inválido.')}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)throw Error('Download exige HTTPS oficial.');
 const host=url.hostname.toLowerCase();
 const engineHosts=new Set(['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com']);
 const modelHost=host==='huggingface.co'||host.endsWith('.huggingface.co')||host==='hf.co'||host.endsWith('.hf.co');
 if(assetType==='engine'&&!engineHosts.has(host))throw Error('Origem do executável não autorizada.');
 if(assetType==='model'&&!modelHost)throw Error('Origem do modelo não autorizada.');
 if(!['engine','model'].includes(assetType))throw Error('Tipo de download desconhecido.');
 return true;
}
