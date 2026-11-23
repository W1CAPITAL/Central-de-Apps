import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/windows.yml',import.meta.url),'utf8');
test('compilação Windows aprovada publica manualmente quatro EXEs mesmo sem Authenticode',()=>{
 const preview=workflow.slice(workflow.indexOf('\n  publish_preview:'),workflow.indexOf('\n  publish:',workflow.indexOf('\n  publish_preview:')));
 assert.ok(preview.includes('if: github.ref == \'refs/heads/main\''),'somente main');
 assert.ok(preview.includes("needs.windows.result == 'success'"),'requer pacote realmente testado');
 assert.ok(preview.includes("needs.windows.outputs.signed != 'true'"),'nao duplicar a release assinada');
 assert.match(preview,/gh release create/,'release GitHub de fato publicada');
 assert.match(preview,/--prerelease/,'nunca falsa release assinada');
 assert.match(preview,/sha256sum/,'integridade dos quatro instaladores');
 assert.match(preview,/source-commits.json/,'origens exatas fixadas');
 for(const name of ['W1-Central-de-Apps','LexisPredict','INFINITUM','PredictBot']){
  assert.ok(preview.includes(name+'-Setup-'),'instalador ausente: '+name);
 }
});
