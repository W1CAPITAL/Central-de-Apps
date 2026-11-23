import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('NSIS encerra somente o executável do diretório sendo atualizado, não outros LexisPredict.exe',()=>{
 const nsis=read('../build/installer.nsh');
 const close=nsis.slice(nsis.indexOf('!macro customCheckAppRunning'),nsis.indexOf('!macroend',nsis.indexOf('!macro customCheckAppRunning')));
 const powershell=read('../scripts/close-installed-process.ps1');
 assert.doesNotMatch(close,/KILL_PROCESS/,'não matar todos os EXEs pelo nome');
 assert.doesNotMatch(close,/FIND_PROCESS/,'não confundir EXEs de instalações diferentes');
 assert.match(close,/W1_INSTALL_TARGET_EXE/);
 assert.match(close,/EncodedCommand/);
 assert.match(powershell,/Get-Process/);
 assert.match(powershell,/\.Path/);
 assert.match(powershell,/OrdinalIgnoreCase/);
 assert.match(powershell,/CloseMainWindow/);
 assert.doesNotMatch(powershell,/-Force|\.Kill\(/,'nunca perder dados forçando um CRM a fechar');
 // EncodedCommand is generated from this checked-in, readable implementation.
 const encoded=Buffer.from(powershell,'utf16le').toString('base64');
 assert.ok(close.includes(encoded),'macro NSIS deve executar exatamente o script revisado');
});
test('instalador mantém erro explícito sem sugerir permissão como causa única do código 2',()=>{
 const main=read('../src/main.mjs');
 assert.doesNotMatch(main,/O instalador encerrou com código.*Confira as permissões do Windows/);
 assert.match(main,/Código 2.*executável|executável.*código 2/i);
});
