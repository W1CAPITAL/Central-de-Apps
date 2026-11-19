import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('installer download has a separate verified install action exposed to the store',()=>{
 const preload=read('../src/preload.cjs');
 const main=read('../src/main.mjs');
 const ui=read('../src/store.js');
 assert.match(preload,/installProduct:\s*appId\s*=>\s*ipcRenderer\.invoke\('central:install-product',appId\)/);
 const start=main.indexOf("ipcMain.handle('central:install-product'");
 assert.ok(start>0,'Missing installer IPC handler');
 const handler=main.slice(start,main.indexOf('\n});',start));
 assert.match(handler,/trustedStoreEvent\(event\)/);
 assert.ok(handler.includes('installProductWithVerification(id)'));
 assert.ok(main.includes('await downloads().verifiedPath(id)'));
 assert.ok(main.includes('await downloads().download(id)'));
 assert.ok(main.includes('planProductInstall(id,'));
 assert.ok(main.includes("child.once('exit'"));
 assert.ok(!main.includes('await shell.openPath(file)'));
 assert.match(ui,/bridge\.installProduct\(app\.id\)/);
 assert.match(ui,/Instalar /);
});
test('local Next startup provides time for a slow Windows PC',()=>{
 const main=read('../src/main.mjs');
 assert.match(main,/for\(let i=0;i<240;i\+\+\)/);
 assert.match(main,/await sleep\(350\)/);
});
