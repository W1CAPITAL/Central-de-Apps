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

 assert.deepEqual(plan.nsisArguments,['--updated','/S','--force-run','/D='+win32.dirname(executablePath)]);
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

test('o atualizador exige SHA-256 e Authenticode antes de substituir a instalação',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 assert.ok(main.includes('downloadVerifiedRelease'));
 assert.ok(main.includes('createInPlaceUpdatePlan'));
 assert.ok(main.includes('await launch(downloadedInstaller,plan.nsisArguments'));
 assert.ok(main.includes("automaticUpdates&&release.phase==='downloaded'"));
 assert.ok(main.includes('verifyWindowsSignature(downloadedInstaller,signatureScript())'));
 assert.ok(main.includes('verifyWindowsSignature(installer,signatureScript())'));
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.deepEqual(pkg.build.asarUnpack,['src/verify-signature.ps1']);
 const workflow=readFileSync(new URL('../.github/workflows/windows.yml',import.meta.url),'utf8');
 assert.ok(workflow.includes('SHA256SUMS.txt'));
 assert.ok(workflow.includes("if: github.ref == 'refs/heads/main'"));
 assert.ok(workflow.includes("needs.windows.outputs.signed == 'true'"));
 assert.ok(workflow.includes('Get-AuthenticodeSignature'));
 assert.ok(workflow.includes("('dist/W1-Central-de-Apps-Setup-' + $env:CENTRAL_VERSION + '-x64.exe')"),'cada caminho deve ser avaliado antes de entrar no array PowerShell');
 assert.ok(workflow.includes("('dist/products/predictbot/PredictBot-Setup-' + $env:CENTRAL_VERSION + '-x64.exe')"),'o array não pode concatenar os quatro caminhos em um único item');
 assert.ok(workflow.includes('Nenhuma release pública será criada'));
 assert.ok(workflow.includes('expect-signature-block'));
 assert.ok(workflow.includes('Update CI sem assinatura recusado antes da execução'));
 const restartSmoke=readFileSync(new URL('../scripts/verify-update-restart.mjs',import.meta.url),'utf8');
 assert.ok(restartSmoke.includes("mode='signed'"));
 assert.ok(restartSmoke.includes('async function waitForRelease'),'o smoke deve observar o estado real em vez de tratar Promise pendente como sucesso');
 assert.ok(restartSmoke.includes("value.phase==='available'&&value.error===null"),'o smoke deve limpar o estado anterior antes de iniciar o download');
 assert.ok(restartSmoke.includes("value.phase==='error'"));
 assert.ok(!restartSmoke.includes("waitForFunction(()=>window.w1Central.getState()"));
 assert.ok(restartSmoke.includes('last-install-attempt.json'),'o teste deve confirmar que o instalador bloqueado não foi executado');
 assert.ok(!workflow.includes('  preview:'));
});

test('marca a atualização como tentativa somente após o instalador iniciar sem falha',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 const method=main.slice(main.indexOf('async function installUpdate('),main.indexOf('async function downloadUpdate('));
 const launched=method.indexOf('await launch(downloadedInstaller,plan.nsisArguments)');
 const marker=method.indexOf('writeFileSync(installAttemptFile');
 assert.ok(launched>=0&&marker>launched,'a marca persistente não pode bloquear novas tentativas após erro ao abrir o instalador');
 assert.match(method,/handingOffUpdate=true/);
});

test('Sair pelo menu também aplica a atualização já baixada, sem criar instalação duplicada',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 const start=main.indexOf("app.on('before-quit'");
 const end=main.indexOf("app.on('window-all-closed'",start);
 assert.ok(start>=0&&end>start);
 const exit=main.slice(start,end);
 assert.match(exit,/event\.preventDefault\(\)/);
 assert.match(exit,/automaticUpdates&&release\.phase==='downloaded'/);
 assert.match(exit,/installUpdate\(true\)/);
});
