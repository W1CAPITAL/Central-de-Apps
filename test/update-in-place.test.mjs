import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,existsSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,win32} from 'node:path';
import {createInPlaceUpdatePlan,pruneUpdateCache} from '../src/update-install.mjs';

test('o instalador recebe o diretório exato da instalação atual, sem criar pasta por versão',()=>{
 const executablePath='C:\\Users\\Davi\\AppData\\Local\\Programs\\W1 Central de Apps\\W1 Central de Apps.exe';
 const installerPath='C:\\Users\\Davi\\AppData\\Roaming\\w1-central\\trusted-updates\\W1-Central-de-Apps-Setup-0.1.80-x64.exe';
 const expectedSha256='a'.repeat(64);
 const plan=createInPlaceUpdatePlan({installerPath,executablePath,parentProcessId:4321,expectedSha256});
 assert.equal(plan.installDirectory,win32.dirname(executablePath));
 assert.equal(plan.executablePath,executablePath);
 assert.deepEqual(plan.helperArgs,[
  '-Installer',installerPath,
  '-InstallDirectory',win32.dirname(executablePath),
  '-Executable',executablePath,
  '-ParentProcessId','4321',
  '-ExpectedSha256',expectedSha256
 ]);
 assert.deepEqual(plan.nsisArguments,['/S','/D='+win32.dirname(executablePath)]);
});

test('rejeita caminhos relativos, hash inválido e PID inválido antes de iniciar atualização',()=>{
 assert.throws(()=>createInPlaceUpdatePlan({installerPath:'setup.exe',executablePath:'C:\\Apps\\App.exe',parentProcessId:1,expectedSha256:'a'.repeat(64)}),/absolutos/);
 assert.throws(()=>createInPlaceUpdatePlan({installerPath:'C:\\Temp\\setup.exe',executablePath:'App.exe',parentProcessId:1,expectedSha256:'a'.repeat(64)}),/absolutos/);
 assert.throws(()=>createInPlaceUpdatePlan({installerPath:'C:\\Temp\\setup.exe',executablePath:'C:\\Apps\\App.exe',parentProcessId:1,expectedSha256:'bad'}),/SHA-256/);
 assert.throws(()=>createInPlaceUpdatePlan({installerPath:'C:\\Temp\\setup.exe',executablePath:'C:\\Apps\\App.exe',parentProcessId:0,expectedSha256:'a'.repeat(64)}),/processo/);
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

test('helper fecha a Central sozinho se ela continuar aberta, confere hash e instala no mesmo diretório',()=>{
 const script=readFileSync(new URL('../src/install-update.ps1',import.meta.url),'utf8');
 assert.ok(script.includes('Get-CimInstance -ClassName Win32_Process'));
 assert.ok(script.includes('$candidate.ExecutablePath'));
 assert.ok(script.includes('$window.CloseMainWindow()'));
 assert.ok(script.includes('Stop-Process -Id $ParentProcessId -Force'));
 assert.ok(script.includes('AddSeconds(12)'));
 assert.ok(script.includes('Get-FileHash'));
 assert.ok(script.includes('/D='));
 assert.ok(script.includes('Start-Process -FilePath $resolvedInstaller'));
 assert.ok(script.includes('Start-Process -FilePath $resolvedExecutable'));
 assert.ok(!script.includes('O aplicativo não encerrou a tempo.'));
 assert.ok(!script.includes('New-Item')&&!script.includes('CreateDirectory'));
});

test('o atualizador usa SHA-256 e não depende de Authenticode',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 assert.ok(main.includes('downloadVerifiedRelease'));
 assert.ok(main.includes('createInPlaceUpdatePlan'));
 assert.ok(main.includes('install-update.ps1'));
 assert.ok(main.includes("automaticUpdates&&release.phase==='downloaded'"));
 assert.ok(!main.includes('verifyWindowsSignature'));
 const workflow=readFileSync(new URL('../.github/workflows/windows.yml',import.meta.url),'utf8');
 assert.ok(workflow.includes('SHA256SUMS.txt'));
 assert.ok(workflow.includes("if: github.ref == 'refs/heads/main'"));
 assert.ok(!workflow.includes('needs.windows.outputs.signed'));
 assert.ok(!workflow.includes('  preview:'));
});
