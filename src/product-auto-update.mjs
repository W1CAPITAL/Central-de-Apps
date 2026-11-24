import {compareVersions} from './distribution.mjs';

/** Only existing, inactive desktop apps are updated in place.
 * The W1 Central does not silently install a product the user never installed.
 */
export function shouldAutoUpdateInstalledProduct({
 enabled,installed,installedVersion,candidateVersion,running,preview=false
}){
 if(!enabled||!installed||running||preview===true||typeof candidateVersion!=='string')return false;
 if(!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(candidateVersion))return false;
 if(typeof installedVersion!=='string'||!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(installedVersion))return false;
 return compareVersions(candidateVersion,installedVersion)>0;
}
