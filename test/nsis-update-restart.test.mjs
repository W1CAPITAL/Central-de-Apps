import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL('../build/installer.nsh',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/windows.yml',import.meta.url),'utf8');

test('uma atualização silenciosa confirma o EXE instalado e o reabre como usuário normal',()=>{
 const installed=script.slice(script.indexOf('!macro customInstall'),script.indexOf('!macroend',script.indexOf('!macro customInstall')));
 assert.match(installed,/\$\{Silent\}/,'o reinício automático só ocorre em instalação silenciosa');
 assert.match(installed,/\$\{isUpdated\}/,'a primeira instalação não deve lançar outro EXE');
 assert.match(installed,/IfFileExists\s+"\$INSTDIR\\\$\{APP_EXECUTABLE_FILENAME\}"/,'não tentar iniciar um EXE ausente');
 assert.match(installed,/\$\{StdUtils\.ExecShellAsUser\}/,'não iniciar o app com privilégios elevados');
 assert.match(installed,/\$INSTDIR\\\$\{APP_EXECUTABLE_FILENAME\}/);
});

test('o smoke de atualização Windows verifica o retorno do processo na mesma instalação',()=>{
 assert.match(workflow,/node scripts\/verify-update-restart\.mjs \$installed \$installer \$env:CENTRAL_VERSION signed/);
 assert.match(workflow,/if \(-not \$relaunched\)/);
 assert.match(workflow,/assinatura Authenticode/i);
});
