import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
const {_electron:electron}=createRequire(resolve('..','desktop-test','package.json'))('playwright-core');

if(process.platform!=='win32')throw Error('O teste visual do EXE exige Windows.');
const results=resolve(process.argv[3]||'desktop-smoke');
const product=process.argv[4]||'central';
mkdirSync(results,{recursive:true});
const profile=mkdtempSync(join(tmpdir(),'w1-desktop-smoke-'));
const env={...process.env};
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
// Não realizar download de modelo no smoke de interface.
env.W1_DESKTOP_SMOKE_TEST='1';
const desktop=await electron.launch({
 executablePath:resolve(process.argv[2]||'dist/win-unpacked/W1 Central de Apps.exe'),
 args:['--user-data-dir='+profile],env,timeout:60000
});
async function verifyImages(page,selector,count){
 const images=page.locator(selector);
 assert.equal(await images.count(),count);
 await images.evaluateAll(async elements=>{
  await Promise.all(elements.map(image=>image.decode()));
  if(elements.some(image=>image.naturalWidth===0))throw Error('Imagem de marca vazia.');
 });
}

try{
 const store=await desktop.firstWindow();
 if(product==='lexispredict'||product==='infinitum'){
  await store.waitForURL(/^http:\/\/127\.0\.0\.1:\d+\//,{timeout:60000});
  if(product==='lexispredict')await store.locator('input[type="password"]').waitFor();
  else {await store.waitForLoadState('domcontentloaded');assert.ok((await store.locator('body').innerText()).trim().length>40,'INFINITUM: tela inicial vazia');}
  assert.equal(await store.evaluate(()=>typeof window.w1Central),'undefined');
  await store.screenshot({path:join(results,product+'.png')});
  console.log(product+' independente: tela local abriu pelo EXE próprio.');
 }else if(product==='predictbot'){
  await store.waitForURL('file:///**/predictbot.html');
  await store.locator('#chat-form').waitFor();
  await verifyImages(store,'.pb-brand img',1);
  const state=await store.evaluate(()=>window.w1Central.openCodeRelay('state'));
  assert.equal(state.state,'stopped');
  await store.screenshot({path:join(results,'predictbot.png')});
  console.log('PredictBot independente: interface local e IPC MCP confirmados, sem inferência.');
 }else{
 await store.waitForURL('file:///**/store.html');
 await store.locator('.product-card.lexispredict button.launch-btn').waitFor({state:'visible'});
 await store.locator('.product-card.infinitum button.launch-btn').waitFor({state:'visible'});
 await verifyImages(store,'.product-card img.app-mark',3);
 await verifyImages(store,'.brand img',1);
 await store.screenshot({path:join(results,'central.png')});
 for(const [id,name] of [['lexispredict','LexisPredict'],['infinitum','INFINITUM']]){
  const created=desktop.waitForEvent('window',{timeout:90000});
  // Testa explicitamente a cópia local integrada. O botão principal, quando
  // há release estável, instala o EXE independente em um clique.
  await store.evaluate(productId=>window.w1Central.launch(productId),id);
  const page=await created;
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.waitForURL(/^http:\/\/127\.0\.0\.1:\d+\//,{timeout:60000});
  await page.waitForLoadState('domcontentloaded');
  assert.ok((await page.locator('body').innerText()).trim().length>40,id+': tela vazia');
  assert.equal(await page.evaluate(()=>typeof window.w1Central),'undefined');
  await page.screenshot({path:join(results,id+'.png')});
  await store.waitForFunction(appId=>window.w1Central.getState().then(s=>s.apps.find(a=>a.id===appId)?.status.phase==='running'),id);
  const count=desktop.windows().length;
  // Testa explicitamente a cópia local integrada. O botão principal, quando
  // há release estável, instala o EXE independente em um clique.
  await store.evaluate(productId=>window.w1Central.launch(productId),id);
  assert.equal(desktop.windows().length,count,'Reabrir deve reutilizar a janela');
  assert.deepEqual(errors,[],id+': erro JavaScript na tela inicial');
  console.log(name+': botão da loja abriu janela local real; IPC isolado e reabertura confirmados.');
 }
 const created=desktop.waitForEvent('window',{timeout:30000});
 await store.evaluate(()=>window.w1Central.launch('predictbot'));
 const bot=await created;
 await bot.waitForURL('file:///**/predictbot.html');
 await bot.locator('#chat-form').waitFor();
 assert.equal((await bot.evaluate(()=>window.w1Central.openCodeRelay('state'))).state,'stopped');
 await bot.screenshot({path:join(results,'predictbot.png')});
 // Catalog cannot make a product renderer a trusted store renderer.
 await assert.rejects(()=>bot.evaluate(()=>window.w1Central.getState()),/Origem não autorizada/);
 assert.equal(desktop.windows().length,4);
 }
 console.log('Smoke visual aprovado sem conta real ou envio de mensagens.');
}finally{
 await desktop.close();
 rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
