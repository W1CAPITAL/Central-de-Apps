import {readdirSync,rmSync} from 'node:fs';
import {join,win32 as winPath} from 'node:path';

const SETUP_NAME=/^([A-Za-z0-9][A-Za-z0-9-]*)-Setup-\d+\.\d+\.\d+-x64\.exe$/i;

export function createInPlaceUpdatePlan({installerPath,executablePath}){
 if(typeof installerPath!=='string'||!winPath.isAbsolute(installerPath)||
    typeof executablePath!=='string'||!winPath.isAbsolute(executablePath))
  throw Error('Os caminhos do instalador e do aplicativo devem ser absolutos.');
 const installerName=winPath.basename(installerPath);
 if(!SETUP_NAME.test(installerName))throw Error('Nome do instalador não reconhecido.');
 const installDirectory=winPath.dirname(executablePath);
 if(!installDirectory||installDirectory===winPath.parse(installDirectory).root)
  throw Error('Diretório de instalação inválido.');
 return Object.freeze({
  installDirectory,executablePath,
  nsisArguments:Object.freeze(['--updated','/S','--force-run','/D='+installDirectory])
 });
}

export function pruneUpdateCache(folder,keepName){
 const match=typeof keepName==='string'?keepName.match(SETUP_NAME):null;
 if(!match)throw Error('Nome do instalador atual inválido.');
 const escaped=match[1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp('^'+escaped+'-Setup-\\d+\\.\\d+\\.\\d+-x64\\.exe(?:\\.partial\\.exe)?$','i');
 for(const entry of readdirSync(folder,{withFileTypes:true})){
  if(!entry.isFile()||entry.name===keepName||!pattern.test(entry.name))continue;
  rmSync(join(folder,entry.name),{force:true});
 }
}
