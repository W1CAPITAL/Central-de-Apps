import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {productInstallation,planProductInstall,readProductRecord,writeProductRecord} from '../src/installed-products.mjs';

test('resolve EXE independente do LexisPredict, INFINITUM e PredictBot em pastas isoladas',()=>{
 const root=mkdtempSync(join(tmpdir(),'w1-product-install-'));
 try{
  for(const [id,name] of [['lexispredict','LexisPredict'],['infinitum','INFINITUM'],['predictbot','PredictBot']]){
   const candidate=productInstallation(id,{localAppData:root});
   assert.equal(candidate.directory,join(root,'Programs',name));
   assert.equal(candidate.exe,join(root,'Programs',name,name+'.exe'));
   mkdirSync(candidate.directory,{recursive:true});writeFileSync(candidate.exe,'fixture');
   assert.equal(productInstallation(id,{localAppData:root}).installed,true);
   const plan=planProductInstall(id,{localAppData:root,installerPath:join(root,name+'-Setup-0.1.212-x64.exe')});
   assert.equal(plan.executablePath,candidate.exe);
   assert.equal(plan.args.at(-1),'/D='+candidate.directory);
   assert.ok(plan.args.includes('/S'));
  }
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('registro de instalação é versionado e mantido entre sessões sem confiar em caminhos externos',()=>{
 const root=mkdtempSync(join(tmpdir(),'w1-install-version-'));
 try{
  const record=join(root,'installed-products.json');
  writeProductRecord(record,'lexispredict','0.1.212');
  assert.equal(readProductRecord(record,'lexispredict').version,'0.1.212');
  writeProductRecord(record,'infinitum','0.1.212');
  assert.equal(readProductRecord(record,'lexispredict').version,'0.1.212');
  assert.equal(readProductRecord(record,'infinitum').version,'0.1.212');
  assert.throws(()=>writeProductRecord(record,'lexispredict','../../payload'),/versão/i);
  assert.throws(()=>productInstallation('windows',{localAppData:root}),/Produto/);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('Central oferece instalação automática completa e botão para abrir produto instalado',()=>{
 const main=await import('node:fs').then(fs=>fs.readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8'));
 const ui=await import('node:fs').then(fs=>fs.readFileSync(new URL('../src/store.js',import.meta.url),'utf8'));
 assert.match(main,/installProductWithVerification/);
 assert.match(main,/central:open-installed-product/);
 assert.match(main,/shell\.openPath\(candidate\.exe\)/);
 assert.match(main,/await downloads\(\)\.download\(id\)/);
 assert.match(main,/child\.once\('exit'/);
 assert.match(ui,/Instalar ou atualizar e abrir/);
 assert.match(ui,/openInstalledProduct/);
});
