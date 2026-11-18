import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('instalações de smoke no Windows aguardam só o instalador, nunca indefinidamente seus subprocessos',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/windows.yml',import.meta.url),'utf8');
 assert.doesNotMatch(workflow,/Start-Process -FilePath \$installer[^\n]*-Wait -PassThru/);
 assert.match(workflow,/\$process\.WaitForExit\(180000\)/);
 assert.match(workflow,/\$repeat\.WaitForExit\(180000\)/);
 assert.match(workflow,/Stop-Process -Id \$process\.Id -Force/);
});
