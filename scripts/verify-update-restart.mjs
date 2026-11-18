import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,createReadStream,mkdirSync,mkdtempSync,statSync,writeFileSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {RELEASES_API} from '../src/distribution.mjs';

const {_electron:electron}=createRequire(resolve('..','desktop-test','package.json'))('playwright-core');
const [executable,installer,buildVersion]=process.argv.slice(2);
const version='1.0.'+buildVersion.split('.')[2];
const name='W1-Central-de-Apps-Setup-'+version+'-x64.exe';
const profile=mkdtempSync(join(tmpdir(),'W1 update test '));
const folder=join(profile,'trusted-updates');
mkdirSync(folder);
writeFileSync(join(profile,'automatic-updates.json'),JSON.stringify({enabled:false}));
copyFileSync(installer,join(folder,name));
const hash=createHash('sha256');
for await(const chunk of createReadStream(installer))hash.update(chunk);
const sha256=hash.digest('hex');
const catalog=[{tag_name:'v'+version,prerelease:false,draft:false,assets:[{
 name,size:statSync(installer).size,digest:'sha256:'+sha256,
 browser_download_url:'https://github.com/W1CAPITAL/Central-de-Apps/releases/download/v'+version+'/'+name
}]}];
const env={...process.env};
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
const desktop=await electron.launch({executablePath:resolve(executable),args:['--user-data-dir='+profile],env,timeout:60000});
try{
 desktop.on('console',message=>console.log('Electron: '+message.text()));
 const page=await desktop.firstWindow();
 page.on('console',message=>console.log('Central: '+message.text()));
 page.on('pageerror',error=>console.error('Central: '+error.message));
 await page.waitForURL('file:///**/store.html');
 const deadline=Date.now()+60000;
 while(!(await page.evaluate(()=>window.w1Central.getState().then(s=>s.release.checkedAt)))){
  if(Date.now()>deadline)throw Error('A consulta inicial ao catálogo não terminou.');
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 const state=await page.evaluate(()=>window.w1Central.getState());
 assert.equal(state.storeVersion,buildVersion);
 assert.equal(state.automaticUpdates,false);
 await desktop.evaluate(({dialog,app},{api,catalog})=>{
  app.once('before-quit',()=>console.log('before-quit recebido'));
  globalThis.fetch=async url=>{
   if(String(url)!==api)throw Error('O instalador já está no cache. Download inesperado: '+url);
   return new Response(JSON.stringify(catalog));
  };
  dialog.showMessageBox=async(...args)=>{
   if(args.at(-1)?.buttons?.[0]!=='Atualizar e reiniciar')throw Error('Confirmação de reinício ausente.');
   console.log('Confirmação de reinício aceita.');
   return {response:0};
  };
 },{api:RELEASES_API,catalog});
 await page.locator('#check-updates').click();
 await page.locator('#download-background').click();
 await page.locator('#install-update').waitFor({state:'visible',timeout:90000});
 const before=await page.evaluate(()=>window.w1Central.getState());
 assert.equal(before.release.phase,'downloaded');
 const closed=page.waitForEvent('close',{timeout:90000});
 const message=page.locator('#update-message').filter({hasText:/Atualização não concluída|não pôde ser iniciada/i});
 const error=message.waitFor({state:'visible',timeout:90000}).then(async()=>{
  throw Error('Falha ao iniciar NSIS: '+await message.textContent());
 });
 await Promise.all([
  Promise.race([closed,error.catch(cause=>{if(!/closed/i.test(cause.message))throw cause;return closed;})]),
  page.locator('#install-update').click({noWaitAfter:true,timeout:15000}).catch(cause=>{if(!/closed/i.test(cause.message))throw cause;})
 ]);
 assert.equal(JSON.parse(readFileSync(join(profile,'last-install-attempt.json'),'utf8')).sha256,sha256);
 console.log('O botão confirmou o pacote em cache e a Central fechou para o NSIS.');
}catch(error){
 const page=desktop.windows()[0];
 if(page&&!page.isClosed()){
  console.error('Estado ao falhar:',await page.evaluate(()=>window.w1Central.getState().then(s=>s.release)).catch(()=>null));
  console.error('Mensagem:',await page.locator('#update-message').textContent({timeout:2000}).catch(()=>''));
 }
 throw error;
}finally{
 if(desktop.process().exitCode===null)await desktop.close().catch(()=>{});
 // O instalador em execução usa o perfil até terminar. O runner descarta a pasta.
}
