import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,existsSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,win32} from 'node:path';
import {createInPlaceUpdatePlan,pruneUpdateCache} from '../src/update-install.mjs';

test('o instalador recebe o diretório exato da instalação atual, sem criar pasta por versão',()=>{
 const executablePath='C:\\Users\\Davi\\AppData\\Local\\Programs\\W1 Central de Apps\\W1 Central de Apps.exe';
 const installerPath='C:\\Users\\Davi\\AppData\\Roaming\\w1-central\\trusted-updates\\W1-Central-de-Apps-Setup-0.1.80-x64.exe';
 const plan=createInPlaceUpdatePlan({installerPath,executablePath});
 assert.equal(plan.installDirectory,win32.dirname(executablePath));
 assert.equal(plan.executablePath,executablePath);

 assert.deepEqual(plan.nsisArguments,['/S','--force-run','/D='+win32.dirname(executablePath)]);
});

test('rejeita caminhos relativos e a raiz do volume',()=>{
 assert.throws(()=>createInPlaceUpdatePlan({installerPath:'setup.exe',executablePath:'relative.exe'}),/absolutos/);
 assert.throws(()=>createInPlaceUpdatePlan({installerPath:'C:/Temp/App-Setup-1.2.3-x64.exe',executablePath:'C:/App.exe'}),/inválido/);
});

test('mantém apenas o instalador mais recente do mesmo aplicativo no cache',()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-update-cache-'));
 try{
  const keep='W1-Central-de-Apps-Setup-0.1.80-x64.exe';
  const old='W1-Central-de-Apps-Setup-0.1.79-x64.exe';
  const other='LexisPredict-Setup-0.1.80-x64.exe';
  writeFileSync(join(folder,keep),'current');
  writeFileSync(join(folder,old),'old');
  writeFileSync(join(folder,other),'other app');
  writeFileSync(join(folder,'notes.txt'),'keep');
  mkdirSync(join(folder,'data'));
  pruneUpdateCache(folder,keep);
  assert.equal(existsSync(join(folder,keep)),true);
  assert.equal(existsSync(join(folder,old)),false);
  assert.equal(existsSync(join(folder,other)),true);
  assert.equal(existsSync(join(folder,'notes.txt')),true);
  assert.equal(existsSync(join(folder,'data')),true);
 }finally{rmSync(folder,{recursive:true,force:true})}
});

test('o atualizador usa SHA-256 e não depende de Authenticode',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 assert.ok(main.includes('downloadVerifiedRelease'));
 assert.ok(main.includes('createInPlaceUpdatePlan'));
 assert.ok(main.includes('spawn(downloadedInstaller,plan.nsisArguments'));
 assert.ok(main.includes("automaticUpdates&&release.phase==='downloaded'"));
 assert.ok(!main.includes('verifyWindowsSignature'));
 const workflow=readFileSync(new URL('../.github/workflows/windows.yml',import.meta.url),'utf8');
 assert.ok(workflow.includes('SHA256SUMS.txt'));
 assert.ok(workflow.includes("if: github.ref == 'refs/heads/main'"));
 assert.ok(!workflow.includes('needs.windows.outputs.signed'));
 assert.ok(!workflow.includes('  preview:'));
});
