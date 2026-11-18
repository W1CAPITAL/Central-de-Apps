import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');

test('loja exclusiva inicia fora do CRM com dois aplicativos locais permitidos',async()=>{
 const {APPS,resolveApp}=await import('../src/catalog.mjs');
 assert.deepEqual(Object.keys(APPS).sort(),['infinitum','lexispredict','predictbot']);
 assert.equal(resolveApp('lexispredict').localHealth,'/api/desktop/health');
 assert.equal(resolveApp('infinitum').localHealth,'/api/desktop/health');
 assert.throws(()=>resolveApp('../../Windows/System32'));
 assert.throws(()=>resolveApp('https://evil.example/'));
 assert.match(read('src/store.html'),/Central de Apps/);
 assert.match(read('src/store.html'),/LexisPredict/);
 assert.match(read('src/store.html'),/INFINITUM/);
 assert.doesNotMatch(read('src/store.html'),/agentinfinitum\.vercel\.app/);
});

test('spawn do Next usa localhost e apenas variáveis públicas',async()=>{
 const {safeEnvironment,isLocalUrl,validNonce}=await import('../src/runtime-policy.mjs');
 const env=safeEnvironment('lexispredict',53231,'a'.repeat(48),{
  PATH:'/bin',USERPROFILE:'C:/Users/Test',
  SUPABASE_SERVICE_ROLE_KEY:'must-not-copy',VERCEL_TOKEN:'must-not-copy'
 });
 assert.equal(env.HOSTNAME,'127.0.0.1');
 assert.equal(env.LEXIS_DESKTOP_LOCAL_NONCE,'a'.repeat(48));
 assert.equal(env.SUPABASE_SERVICE_ROLE_KEY,undefined);
 assert.equal(env.VERCEL_TOKEN,undefined);
 assert.equal(env.ELECTRON_RUN_AS_NODE,'1');
 assert.equal(isLocalUrl('http://127.0.0.1:53231/processos',53231),true);
 assert.equal(isLocalUrl('http://localhost:53231',53231),false);
 assert.equal(isLocalUrl('https://127.0.0.1:53231',53231),false);
 assert.equal(validNonce('b'.repeat(48)),true);
 assert.equal(validNonce('secret'),false);
});

test('instalador empacota ambos os servidores e não baixa executáveis arbitrários',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.build.appId,'br.com.w1capital.centraldeapps');
 const products=pkg.build.extraResources.find(r=>r.from==='products'&&r.to==='products');
 assert.ok(products);
 for(const app of ['lexispredict','infinitum']){
  assert.ok(products.filter.includes(app+'/**/*'));
 }
 assert.match(read('src/main.mjs'),/requestSingleInstanceLock/);
 assert.match(read('src/main.mjs'),/openStoreWindow/);
 assert.match(read('src/main.mjs'),/ELECTRON_RUN_AS_NODE|safeEnvironment/);
 assert.doesNotMatch(read('src/main.mjs'),/execSync|eval\(|shell:\s*true/);
 assert.match(read('src/preload.cjs'),/contextBridge\.exposeInMainWorld/);
});

test('build Windows compila fontes originais e não usa o deploy Vercel como backend de execução',()=>{
 const w=read('.github/workflows/windows.yml');
 assert.match(w,/W1CAPITAL\/LexisPredict/);
 assert.match(w,/W1CAPITAL\/Infinitum/);
 assert.doesNotMatch(w,/ProjectW1SC\/INFINITUM/);
 assert.match(read('src/catalog.mjs'),/W1CAPITAL\/Infinitum/);
 assert.match(w,/LEXIS_DESKTOP_STANDALONE/);
 assert.match(w,/KILLA_DESKTOP_STANDALONE/);
 assert.match(w,/npm.*test/);
 assert.match(w,/stage-next\.mjs/);
 assert.doesNotMatch(w,/vercel\s+(deploy|build)/i);
});

test('stage-next materializes pnpm symlinks before packaging Windows',()=>{
 const stage=read('scripts/stage-next.mjs');
 assert.match(stage,/dereference:true/);
 assert.match(stage,/node_modules.*next.*package\.json/);
 assert.match(stage,/start-server\.js/);
});
