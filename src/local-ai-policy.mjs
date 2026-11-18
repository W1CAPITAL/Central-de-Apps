import {isAbsolute,win32} from 'node:path';

export const LOCAL_AI_ENGINE=Object.freeze({
 version:'b12521',
 fileName:'llama-b12521-bin-win-cpu-x64.zip',
 url:'https://github.com/ggml-org/llama.cpp/releases/download/b12521/llama-b12521-bin-win-cpu-x64.zip',
 size:25555594,
 sha256:'bd4e093bce292452248c318d4b176fbfebe1ca43a7f3779ebb3846fe7753653e'
});

export const LOCAL_AI_MODEL=Object.freeze({
 name:'Microsoft BitNet b1.58 2B-4T',
 id:'bitnet-2b',
 revision:'a1f2f1c765812aa8af3f6eda4a313707064bba15',
 fileName:'ggml-model-i2_s.gguf',
 url:'https://huggingface.co/microsoft/bitnet-b1.58-2B-4T-gguf/resolve/a1f2f1c765812aa8af3f6eda4a313707064bba15/ggml-model-i2_s.gguf',
 sha256:'4221b252fdd5fd25e15847adfeb5ee88886506ba50b8a34548374492884c2162',
 size:1187801280
});

export function selectLocalAIProfile({platform,arch,totalMemory,logicalCores}={}){
 const reason=platform!=='win32'?'A instalação automática está preparada para Windows.':
  arch!=='x64'?'Este pacote requer Windows x64.':
  !Number.isFinite(totalMemory)||totalMemory<7.5*1024**3?'O BitNet 2B exige pelo menos 8 GB de RAM para este perfil econômico.':'';
 if(reason)return Object.freeze({supported:false,reason});
 const cores=Number.isInteger(logicalCores)&&logicalCores>0?logicalCores:2;
 return Object.freeze({supported:true,threads:Math.max(1,Math.min(2,cores)),context:1024,output:512,gpuLayers:0,parallel:1,idleSleepSeconds:300});
}

export function createLocalAIProviderConfig({port=8765}={}){
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Porta da IA local inválida.');
 return {
  $schema:'https://opencode.ai/config.json',
  providers:{
   'w1-local':{
    name:'W1 Local AI',
    env:['W1_LOCAL_AI_KEY'],
    package:'@opencode/ai/providers/openai-compatible',
    settings:{baseURL:'http://127.0.0.1:'+port+'/v1',timeout:300000},
    models:{
     'bitnet-2b':{
      name:LOCAL_AI_MODEL.name,
      modelID:'w1-bitnet-2b',
      capabilities:{tools:false,input:['text'],output:['text']},
      limit:{context:1024,output:512}
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
  '--alias','w1-bitnet-2b'
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
