import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zoomFactorForAction,zoomPercent,VALID_ZOOM_ACTIONS} from '../src/product-zoom.mjs';

test('LexisPredict aumenta e diminui zoom por etapas, limitado a 50%–200%',()=>{
 assert.equal(zoomFactorForAction(1,'in'),1.1);
 assert.equal(zoomFactorForAction(1,'out'),0.9);
 assert.equal(zoomFactorForAction(1.9,'in'),2);
 assert.equal(zoomFactorForAction(0.5,'out'),0.5);
 assert.equal(zoomFactorForAction(1.6,'reset'),1);
 assert.equal(zoomPercent(1.3),'130%');
});
test('não aceita ações desconhecidas e nunca perde escala válida',()=>{
 for(const action of ['../../',null,4])assert.throws(()=>zoomFactorForAction(1,action),/zoom/i);
 assert.deepEqual([...VALID_ZOOM_ACTIONS],['in','out','reset']);
});
test('menu nativo do LexisPredict oferece teclas e persiste preferência no perfil',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 assert.match(main,/zoomFactorForAction/);
 assert.match(main,/win\.setMenu/);
 assert.match(main,/CommandOrControl\+Equal/);
 assert.match(main,/CommandOrControl\+Minus/);
 assert.match(main,/CommandOrControl\+0/);
 assert.match(main,/zoom-preferences\.json/);
});
