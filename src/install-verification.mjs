// Windows file metadata is authoritative, not a saved installation record.
export function normalizeInstalledVersion(value){
 const match=String(value??'').trim().match(/^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})(?:\.0)?$/);
 return match?match.slice(1,4).join('.'):null;
}
export function confirmInstalledVersion(actual,expected){
 const found=normalizeInstalledVersion(actual);
 if(!found||found!==normalizeInstalledVersion(expected))throw Error('O instalador terminou, mas a versão esperada não foi confirmada no executável. Confira a instalação antes de tentar novamente.');
 return found;
}
export function canRetryInstall(previous,asset,now=Date.now()){
 if(!previous||previous.sha256!==asset?.sha256)return true;
 const age=now-Number(previous.startedAt);
 return Number.isFinite(age)&&age>=15*60*1000;
}
export function sameRelease(a,b){return !!a&&!!b&&a.version===b.version&&a.sha256===b.sha256&&a.preview===b.preview}
