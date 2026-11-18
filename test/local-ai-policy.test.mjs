import test from 'node:test';
import assert from 'node:assert/strict';
import {
 LOCAL_AI_ENGINE,LOCAL_AI_MODEL,selectLocalAIProfile,
 createLocalAIProviderConfig,createLlamaServerArgs,validateAssetRedirect
} from '../src/local-ai-policy.mjs';

test('perfil econômico aceita Windows x64 com 8 GB e limita CPU/contexto',()=>{
 const profile=selectLocalAIProfile({platform:'win32',arch:'x64',totalMemory:8*1024**3,logicalCores:4});
 assert.equal(profile.supported,true);
 assert.equal(profile.threads,2);
 assert.equal(profile.context,1024);
 assert.equal(profile.output,512);
 assert.equal(profile.gpuLayers,0);
});

test('não tenta instalar o modelo 2B em memória insuficiente ou plataforma incompatível',()=>{
 for(const input of [
  {platform:'win32',arch:'x64',totalMemory:6*1024**3,logicalCores:4},
  {platform:'linux',arch:'x64',totalMemory:16*1024**3,logicalCores:8},
  {platform:'win32',arch:'arm64',totalMemory:16*1024**3,logicalCores:8}
 ]) assert.equal(selectLocalAIProfile(input).supported,false);
});

test('fixa executável CPU e pesos oficiais da Microsoft com hashes verificados',()=>{
 assert.equal(LOCAL_AI_ENGINE.version,'b12521');
 assert.match(LOCAL_AI_ENGINE.url,/ggml-org\/llama\.cpp\/releases\/download\/b12521\/llama-b12521-bin-win-cpu-x64\.zip$/);
 assert.equal(LOCAL_AI_ENGINE.sha256,'bd4e093bce292452248c318d4b176fbfebe1ca43a7f3779ebb3846fe7753653e');
 assert.equal(LOCAL_AI_ENGINE.size,25555594);
 assert.equal(LOCAL_AI_MODEL.revision,'daeb8e2d528a760970442092f6bf1e55c3b659eb');
 assert.equal(LOCAL_AI_MODEL.sha256,'d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5');
 assert.equal(LOCAL_AI_MODEL.size,1282439264);
 assert.match(LOCAL_AI_MODEL.url,/huggingface\.co\/ggml-org\/Qwen3-1\.7B-GGUF\/resolve\/daeb8e2d528a760970442092f6bf1e55c3b659eb\/Qwen3-1\.7B-Q4_K_M\.gguf$/);
});

test('configura provider OpenAI compatível sem sobrescrever o modelo padrão do usuário',()=>{
 const config=createLocalAIProviderConfig({port:8765});
 assert.equal(config.model,undefined);
 assert.equal(config.providers['w1-local'].package,'@opencode/ai/providers/openai-compatible');
 assert.equal(config.providers['w1-local'].settings.apiKey,'{env:W1_LOCAL_AI_KEY}');
 assert.equal(config.providers['w1-local'].settings.baseURL,'http://127.0.0.1:8765/v1');
 assert.equal(config.providers['w1-local'].models['qwen3-1.7b'].limit.context,1024);
 assert.equal(config.providers['w1-local'].models['qwen3-1.7b'].modelID,'w1-qwen3-1.7b');
 assert.equal(config.providers['w1-local'].models['qwen3-1.7b'].capabilities.tools,false);
 assert.equal(JSON.stringify(config).includes('secret'),false);
});

test('servidor usa apenas loopback, API key em arquivo, CPU e suspensão por inatividade',()=>{
 const args=createLlamaServerArgs({modelPath:'C:\\W1\\model.gguf',keyPath:'C:\\W1\\key.txt',port:8765,threads:2,context:1024});
 const pairs=new Map();
 for(let i=0;i<args.length;i++)if(args[i].startsWith('--'))pairs.set(args[i],args[i+1]);
 assert.equal(pairs.get('--host'),'127.0.0.1');
 assert.equal(pairs.get('--port'),'8765');
 assert.equal(pairs.get('--api-key-file'),'C:\\W1\\key.txt');
 assert.equal(pairs.get('--ctx-size'),'1024');
 assert.equal(pairs.get('--threads'),'2');
 assert.equal(pairs.get('--gpu-layers'),'0');
 assert.equal(pairs.get('--parallel'),'1');
 assert.equal(pairs.get('--sleep-idle-seconds'),'300');
 assert.ok(args.includes('--no-webui'));
 assert.ok(!args.includes('--api-key'));
});

test('aceita apenas redirecionamentos HTTPS dos hosts oficiais do GitHub e Hugging Face',()=>{
 assert.equal(validateAssetRedirect('https://release-assets.githubusercontent.com/file.zip','engine'),true);
 assert.equal(validateAssetRedirect('https://huggingface.co/file.gguf','model'),true);
 assert.equal(validateAssetRedirect('https://cas-bridge.xethub.hf.co/file.gguf','model'),true);
 assert.throws(()=>validateAssetRedirect('http://release-assets.githubusercontent.com/file.zip','engine'));
 assert.throws(()=>validateAssetRedirect('https://evil.example/file.zip','engine'));
 assert.throws(()=>validateAssetRedirect('https://release-assets.githubusercontent.com/file.gguf','model'));
});

test('o modelo padrão é GGUF Qwen3 compatível com stock llama.cpp, não I2_S experimental',()=>{
 assert.equal(LOCAL_AI_MODEL.id,'qwen3-1.7b');
 assert.match(LOCAL_AI_MODEL.fileName,/Q4_K_M\.gguf$/);
 assert.doesNotMatch(LOCAL_AI_MODEL.fileName,/i2_s/i);
});
